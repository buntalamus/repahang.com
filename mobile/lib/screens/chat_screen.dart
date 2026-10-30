import 'dart:async';
import 'dart:math';

import 'package:flutter/material.dart';

import '../api.dart';
import '../theme.dart';
import '../widgets/common.dart';

List<Map<String, dynamic>> _rows(Object? list) =>
    (list as List? ?? []).map((e) => Map<String, dynamic>.from(e as Map)).toList();

int _int(Object? value) => int.tryParse('${value ?? ''}') ?? 0;

/// Idempotency key for /api/support-chat.php sends (16–80 of [A-Za-z0-9_-]).
String _clientId() {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  final random = Random.secure();
  return List.generate(24, (_) => chars[random.nextInt(chars.length)]).join();
}

/// One support conversation (/api/support-chat.php). Users talk to Admin
/// about their own thread; Admin opens a user's thread from [ChatInboxScreen].
class ChatScreen extends StatefulWidget {
  const ChatScreen({super.key, this.userId, this.title = 'Hubungi Admin'});

  /// The thread owner; null for the signed-in user's own thread.
  final int? userId;
  final String title;

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  final _messages = <Map<String, dynamic>>[];
  final _input = TextEditingController();
  final _scroll = ScrollController();
  Timer? _poll;
  bool _loading = true;
  bool _hasMore = false;
  bool _sending = false;
  String? _error;

  int get _owner => widget.userId ?? Api.instance.user.value!.id;
  bool get _admin => Api.instance.user.value!.isAdmin;

  @override
  void initState() {
    super.initState();
    _load();
    // The website polls every 8 seconds while a conversation is open.
    _poll = Timer.periodic(const Duration(seconds: 8), (_) => _fetchNew());
  }

  @override
  void dispose() {
    _poll?.cancel();
    _input.dispose();
    _scroll.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final body = await Api.instance.get('/api/support-chat.php', {'action': 'messages', 'user_id': _owner});
      if (!mounted) return;
      setState(() {
        _messages
          ..clear()
          ..addAll(_rows(body['data']));
        _hasMore = body['has_more'] == true;
        _loading = false;
        _error = null;
      });
      _markRead();
      _toBottom();
    } on ApiException catch (error) {
      if (mounted) {
        setState(() {
          _loading = false;
          _error = error.message;
        });
      }
    }
  }

  Future<void> _fetchNew() async {
    if (_loading || _messages.isEmpty && _error != null) return;
    try {
      final body = await Api.instance.get('/api/support-chat.php', {
        'action': 'messages',
        'user_id': _owner,
        if (_messages.isNotEmpty) 'after': _messages.last['id'],
      });
      final fresh = _rows(body['data']).where((m) => !_messages.any((e) => '${e['id']}' == '${m['id']}')).toList();
      if (fresh.isEmpty || !mounted) return;
      setState(() => _messages.addAll(fresh));
      _markRead();
      _toBottom();
    } catch (_) {
      // Polling retries on the next tick.
    }
  }

  Future<void> _loadOlder() async {
    if (_messages.isEmpty) return;
    try {
      final body = await Api.instance.get('/api/support-chat.php',
          {'action': 'messages', 'user_id': _owner, 'before': _messages.first['id']});
      if (!mounted) return;
      setState(() {
        _messages.insertAll(0, _rows(body['data']));
        _hasMore = body['has_more'] == true;
      });
    } on ApiException catch (error) {
      if (mounted) showToast(context, error.message, ToastType.error);
    }
  }

  void _markRead() {
    if (_messages.isEmpty) return;
    Api.instance.post('/api/support-chat.php', {'action': 'read', 'user_id': _owner, 'through_id': _messages.last['id']})
        .catchError((_) => <String, dynamic>{});
  }

  void _toBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scroll.hasClients) _scroll.jumpTo(_scroll.position.maxScrollExtent);
    });
  }

  Future<void> _send() async {
    final body = _input.text.trim();
    if (body.isEmpty || _sending) return;
    if (body.length > 2000) {
      showToast(context, 'Mesej terlalu panjang (maksimum 2000 aksara).', ToastType.warning);
      return;
    }
    setState(() => _sending = true);
    final clientId = _clientId();
    // Retried sends reuse the same client id, so the server never duplicates them.
    for (var attempt = 0; attempt < 3; attempt++) {
      try {
        await Api.instance.post('/api/support-chat.php',
            {'action': 'send', 'user_id': _owner, 'body': body, 'client_id': clientId});
        _input.clear();
        await _fetchNew();
        break;
      } on ApiException catch (error) {
        final retry = error.status == null && attempt < 2;
        if (!retry) {
          if (mounted) showToast(context, error.message, ToastType.error);
          break;
        }
        await Future<void>.delayed(const Duration(seconds: 2));
      }
    }
    if (mounted) setState(() => _sending = false);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(widget.title)),
      body: Column(children: [
        Expanded(
          child: _loading
              ? const Loading()
              : _error != null
                  ? EmptyState(icon: Icons.cloud_off_rounded, title: 'Tidak dapat dimuatkan', subtitle: _error,
                      actionLabel: 'Cuba semula', onAction: _load)
                  : _messages.isEmpty
                      ? EmptyState(icon: Icons.forum_outlined, title: 'Tiada mesej lagi',
                          subtitle: _admin ? null : 'Tulis soalan anda kepada Admin di bawah.')
                      : ListView.builder(
                          controller: _scroll,
                          padding: const EdgeInsets.fromLTRB(12, 12, 12, 12),
                          itemCount: _messages.length + (_hasMore ? 1 : 0),
                          itemBuilder: (context, i) {
                            if (_hasMore && i == 0) {
                              return Center(child: TextButton(onPressed: _loadOlder, child: const Text('Mesej lebih awal')));
                            }
                            final m = _messages[i - (_hasMore ? 1 : 0)];
                            // My messages sit on the right: Admin's own replies, or the user's own messages.
                            final mine = ('${m['is_admin']}' == '1') == _admin;
                            return _Bubble(message: m, mine: mine);
                          },
                        ),
        ),
        SafeArea(
          top: false,
          child: Container(
            padding: const EdgeInsets.fromLTRB(12, 8, 8, 8),
            decoration: const BoxDecoration(color: Colors.white, border: Border(top: BorderSide(color: AppColors.line))),
            child: Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
              Expanded(
                child: TextField(
                  controller: _input,
                  minLines: 1,
                  maxLines: 5,
                  maxLength: 2000,
                  textCapitalization: TextCapitalization.sentences,
                  decoration: const InputDecoration(hintText: 'Tulis mesej...', counterText: '',
                      fillColor: AppColors.background, contentPadding: EdgeInsets.symmetric(horizontal: 14, vertical: 12)),
                ),
              ),
              const SizedBox(width: 6),
              IconButton.filled(
                style: IconButton.styleFrom(backgroundColor: AppColors.black, foregroundColor: Tw.pahangYellow,
                    minimumSize: const Size(46, 46)),
                onPressed: _sending ? null : _send,
                icon: _sending
                    ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Tw.pahangYellow))
                    : const Icon(Icons.send_rounded),
              ),
            ]),
          ),
        ),
      ]),
    );
  }
}

class _Bubble extends StatelessWidget {
  const _Bubble({required this.message, required this.mine});
  final Map<String, dynamic> message;
  final bool mine;

  @override
  Widget build(BuildContext context) {
    final time = '${message['created_at'] ?? ''}';
    return Align(
      alignment: mine ? Alignment.centerRight : Alignment.centerLeft,
      child: ConstrainedBox(
        constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.78),
        child: Container(
          margin: const EdgeInsets.symmetric(vertical: 4),
          padding: const EdgeInsets.fromLTRB(14, 10, 14, 8),
          decoration: BoxDecoration(
            color: mine ? AppColors.black : Colors.white,
            borderRadius: BorderRadius.only(
              topLeft: const Radius.circular(16),
              topRight: const Radius.circular(16),
              bottomLeft: Radius.circular(mine ? 16 : 4),
              bottomRight: Radius.circular(mine ? 4 : 16),
            ),
            boxShadow: AppColors.shadow,
          ),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            if (!mine)
              Text(text(message['sender_name']),
                  style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: AppColors.yellowDeep)),
            Text(text(message['body'], ''), style: TextStyle(fontSize: 14.5, height: 1.4, color: mine ? Colors.white : AppColors.text)),
            const SizedBox(height: 2),
            Text(time.length >= 16 ? time.substring(11, 16) : time,
                style: TextStyle(fontSize: 10.5, color: mine ? Colors.white54 : AppColors.faint)),
          ]),
        ),
      ),
    );
  }
}

/// Admin: users' support threads, newest first (/api/support-chat.php?action=threads).
class ChatInboxScreen extends StatefulWidget {
  const ChatInboxScreen({super.key});

  @override
  State<ChatInboxScreen> createState() => _ChatInboxScreenState();
}

class _ChatInboxScreenState extends State<ChatInboxScreen> {
  final _view = GlobalKey<AsyncViewState<Map<String, dynamic>>>();
  String _search = '';
  int _page = 1;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Chat Pengguna')),
      body: AsyncView<Map<String, dynamic>>(
        key: _view,
        load: () => Api.instance.get('/api/support-chat.php',
            {'action': 'threads', 'page': _page, if (_search.isNotEmpty) 'search': _search}),
        builder: (context, body, reload) {
          final threads = _rows(body['data']);
          final pages = (_int(body['total']) / 30).ceil();
          return RefreshList(onRefresh: reload, children: [
            TextField(
              decoration: const InputDecoration(hintText: 'Cari nama', prefixIcon: Icon(Icons.search_rounded)),
              textInputAction: TextInputAction.search,
              onSubmitted: (v) {
                _search = v.trim();
                _page = 1;
                _view.currentState?.reload();
              },
            ),
            const SizedBox(height: 12),
            if (threads.isEmpty) const EmptyState(icon: Icons.forum_outlined, title: 'Tiada perbualan'),
            if (threads.isNotEmpty)
              AppCard(
                padding: EdgeInsets.zero,
                child: Column(children: [
                  for (final (i, t) in threads.indexed) ...[
                    if (i > 0) const Divider(indent: 72),
                    ListTile(
                      onTap: () async {
                        await Navigator.of(context).push<void>(MaterialPageRoute(
                            builder: (_) => ChatScreen(userId: _int(t['user_id']), title: text(t['nama_penuh']))));
                        await _view.currentState?.reload();
                      },
                      leading: Avatar(name: text(t['nama_penuh']), radius: 20),
                      title: Text(text(t['nama_penuh']), maxLines: 1, overflow: TextOverflow.ellipsis,
                          style: TextStyle(fontSize: 14, fontWeight: _int(t['unread_count']) > 0 ? FontWeight.w800 : FontWeight.w600)),
                      subtitle: Text('${'${t['is_admin']}' == '1' ? 'Anda: ' : ''}${text(t['preview'], '')}',
                          maxLines: 1, overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontSize: 12.5, color: AppColors.muted)),
                      trailing: _int(t['unread_count']) > 0
                          ? Badge(backgroundColor: Tw.red600, label: Text('${t['unread_count']}'))
                          : Text(text(t['role'], ''), style: const TextStyle(fontSize: 11, color: AppColors.faint)),
                    ),
                  ],
                ]),
              ),
            if (pages > 1)
              Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                IconButton(
                  onPressed: _page <= 1 ? null : () {
                    _page--;
                    _view.currentState?.reload();
                  },
                  icon: const Icon(Icons.chevron_left_rounded),
                ),
                Text('Halaman $_page / $pages'),
                IconButton(
                  onPressed: _page >= pages ? null : () {
                    _page++;
                    _view.currentState?.reload();
                  },
                  icon: const Icon(Icons.chevron_right_rounded),
                ),
              ]),
          ]);
        },
      ),
    );
  }
}
