import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'config.dart';

class ApiException implements Exception {
  ApiException(this.message, [this.status, this.code, this.reason]);
  final String? code;
  final String? reason;
  final String message;
  final int? status;
  @override
  String toString() => message;
}

class SessionUser {
  SessionUser(this.json);
  final Map<String, dynamic> json;
  int get id => (json['id'] as num).toInt();
  String get name => '${json['nama_penuh'] ?? ''}';
  String get email => '${json['email'] ?? ''}';
  String get role => '${json['role'] ?? ''}';
  String get jenisPengadil => '${json['jenis_pengadil'] ?? ''}';
  bool get canReferee => '${json['can_referee']}' == '1';
  bool get canRa => '${json['can_ra']}' == '1';
  bool get isAdmin => role == 'Admin';
  bool get isDistrict => role == 'PP Daerah';

  /// Roles that receive appointments (/api/tugasan.php).
  bool get hasAssignments => const ['Pengadil', 'Penilai', 'PP Daerah'].contains(role);

  /// Roles that manage appointments (/api/kejohanan.php, /api/jadual-perlawanan.php).
  bool get managesAppointments => isAdmin || isDistrict;
}

/// Talks to the same /api/*.php endpoints as the website, authenticated with
/// the session token from /api/mobile-login.php as `Authorization: Bearer`.
class Api {
  Api._() {
    _dio.interceptors.add(InterceptorsWrapper(onRequest: (options, handler) {
      // Follows the production/demo choice made on the login screen.
      options.baseUrl = apiBase;
      final token = _token;
      if (token != null) options.headers['Authorization'] = 'Bearer $token';
      handler.next(options);
    }));
  }

  static final Api instance = Api._();

  static const _tokenKey = 'session_token';
  static const _userKey = 'session_user';
  final _storage = const FlutterSecureStorage();
  final _dio = Dio(BaseOptions(
    baseUrl: apiBase,
    connectTimeout: const Duration(seconds: 15),
    receiveTimeout: const Duration(seconds: 30),
    responseType: ResponseType.json,
    validateStatus: (_) => true,
  ));
  String? _token;
  DateTime? _lastActivitySent;

  /// Signed-in user; null once the session ends. The app shell listens to this.
  final ValueNotifier<SessionUser?> user = ValueNotifier(null);

  String? get token => _token;

  /// Lets widget tests answer requests without a server.
  @visibleForTesting
  Dio get dio => _dio;

  Future<void> restore() async {
    _token = await _storage.read(key: _tokenKey);
    if (_token == null) return;
    try {
      final session = await get('/api/session.php');
      if (session['authenticated'] != true) {
        await _clear();
        return;
      }
      user.value = SessionUser({
        'id': session['user_id'],
        'email': session['user_email'],
        'role': session['user_role'],
        'nama_penuh': session['nama_penuh'],
        'jenis_pengadil': session['user_jenis_pengadil'],
        'can_referee': session['can_referee'],
        'can_ra': session['can_ra'],
      });
    } on ApiException catch (error) {
      // Offline: keep the stored session and let screens retry.
      if (error.status == 401) {
        await _clear();
      } else {
        final cached = await _storage.read(key: _userKey);
        if (cached != null) user.value = SessionUser(_decode(cached));
      }
    }
  }

  Future<void> login(String email, String password) async {
    final body = await post('/api/mobile-login.php', {'email': email, 'password': password});
    _token = '${body['token']}';
    final data = Map<String, dynamic>.from(body['data'] as Map);
    await _storage.write(key: _tokenKey, value: _token);
    await _storage.write(key: _userKey, value: _encode(data));
    user.value = SessionUser(data);
  }

  /// Foreground taps/keys count as activity; push refresh and polling do not.
  void recordActivity() {
    if (_token == null) return;
    final now = DateTime.now();
    if (_lastActivitySent != null && now.difference(_lastActivitySent!) < const Duration(minutes: 5)) return;
    _lastActivitySent = now;
    post('/api/account-activity.php', {}).catchError((Object error) {
      _lastActivitySent = null;
      return <String, dynamic>{};
    });
  }

  Future<void> logout() async {
    try {
      await post('/api/mobile-logout.php', {});
    } catch (_) {
      // The session is dropped locally either way.
    }
    await _clear();
  }

  /// Switches between production and demo.refpahang.com. The session (and
  /// with it this device's push registration) belongs to one server only.
  Future<void> switchServer(bool demo) async {
    if (_token != null) await logout();
    await saveServerChoice(demo);
  }

  Future<void> _clear() async {
    _token = null;
    _lastActivitySent = null;
    await _storage.delete(key: _tokenKey);
    await _storage.delete(key: _userKey);
    user.value = null;
  }

  Future<Map<String, dynamic>> get(String path, [Map<String, dynamic>? query]) =>
      _send(() => _dio.get(path, queryParameters: query));

  Future<Map<String, dynamic>> put(String path, Map<String, dynamic> body) =>
      _send(() => _dio.put(path, data: body));

  Future<Map<String, dynamic>> post(String path, Map<String, dynamic> body) =>
      _send(() => _dio.post(path, data: body));

  Future<Map<String, dynamic>> delete(String path, [Map<String, dynamic>? body, Map<String, dynamic>? query]) =>
      _send(() => _dio.delete(path, data: body, queryParameters: query));

  /// Multipart upload of one file, as the website's forms send it.
  Future<Map<String, dynamic>> upload(String path, String field, List<int> bytes, String filename) =>
      _send(() => _dio.post(path, data: FormData.fromMap({
            field: MultipartFile.fromBytes(bytes, filename: filename),
          })));

  Future<Map<String, dynamic>> _send(Future<Response<dynamic>> Function() request) async {
    Response<dynamic> response;
    try {
      response = await request();
    } on DioException {
      throw ApiException('Tiada sambungan internet. Sila cuba lagi.');
    }
    final data = response.data;
    final body = data is Map ? Map<String, dynamic>.from(data) : <String, dynamic>{};
    final status = response.statusCode ?? 0;
    if (status == 401 && _token != null && !response.requestOptions.path.contains('mobile-login')) {
      await _clear();
    }
    if (status >= 400 || body['error'] == true) {
      throw ApiException('${body['message'] ?? 'Ralat pelayan ($status).'}', status,
          body['code'] as String?, body['reason'] as String?);
    }
    return body;
  }

  /// Private /uploads images need the session header too.
  Map<String, String> get imageHeaders => {if (_token != null) 'Authorization': 'Bearer $_token'};

  String absoluteUrl(String path) => path.startsWith('http') ? path : '$apiBase${path.startsWith('/') ? '' : '/'}$path';

  static String _encode(Map<String, dynamic> value) => jsonEncode(value);

  static Map<String, dynamic> _decode(String value) => Map<String, dynamic>.from(jsonDecode(value) as Map);
}
