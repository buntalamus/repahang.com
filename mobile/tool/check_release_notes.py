#!/usr/bin/env python3
"""Validate user-facing notes before publishing an APK or Shorebird patch."""
import argparse
import datetime
import json
import re
import subprocess
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('release', help='Exact release including build, e.g. 1.3.0+7')
    target = parser.add_mutually_exclusive_group(required=True)
    target.add_argument('--patch', type=int, help='0 for a new native APK')
    target.add_argument('--next-patch', action='store_true', help='Read the next patch number from Shorebird')
    parser.add_argument('--live', action='store_true', help='Require identical notes on the production API')
    args = parser.parse_args()
    mobile = Path(__file__).resolve().parents[1]
    entries = json.loads((mobile.parent / 'cloudflare/src/mobile-release-notes.json').read_text())
    seen = set()
    for entry in entries:
        key = (entry['release_version'], entry['patch'])
        if key in seen:
            raise ValueError(f'Duplicate changelog: {key}')
        seen.add(key)
        if not re.fullmatch(r'\d+\.\d+\.\d+\+\d+', key[0]) or type(key[1]) is not int or key[1] < 0:
            raise ValueError(f'Invalid release or patch: {key}')
        datetime.date.fromisoformat(entry['date'])
        if not entry['changes'] or not all(isinstance(line, str) and len(line.strip()) > 10 for line in entry['changes']):
            raise ValueError(f'Write meaningful user-facing changes: {key}')
    patch = args.patch
    if args.next_patch:
        result = subprocess.run([str(Path.home() / '.shorebird/bin/shorebird'), 'patches', 'list',
                                 '--release-version', args.release, '--json'],
                                cwd=mobile, check=True, capture_output=True, text=True)
        payload = json.loads(next(line for line in reversed(result.stdout.splitlines()) if line.startswith('{')))
        patches = payload['data']['patches']
        patch = max((row['number'] for row in patches), default=0) + 1
    entry = next((row for row in entries if row['release_version'] == args.release and row['patch'] == patch), None)
    if not entry:
        raise ValueError(f'Changelog required for {args.release}, patch {patch}; write it before publishing.')
    if args.live:
        response = subprocess.run(['curl', '-fsS', '--max-time', '20', '-H', 'Cache-Control: no-cache',
                                   'https://refpahang.com/api/mobile-version.php'], check=True, capture_output=True, text=True)
        published = json.loads(response.stdout).get('release_notes', [])
        if entry not in published:
            raise ValueError('Deploy the matching changelog to the production Worker before publishing the mobile update.')
    print(f'Changelog verified: {args.release}, patch {patch}' + (' (production)' if args.live else ' (local)'))


if __name__ == '__main__':
    try:
        main()
    except (ValueError, KeyError, StopIteration, subprocess.CalledProcessError) as error:
        raise SystemExit(f'Release stopped: {error}')
