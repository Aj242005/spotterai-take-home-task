#!/usr/bin/env bash
cd "$(dirname "$0")/../.." || exit 1
for i in $(seq 1 240); do
  out=$(".agents/skills/impeccable/scripts/impeccable" serve-question --wait --key 350cf9c5 2>&1)
  rc=$?
  if [ $rc -eq 3 ]; then continue; fi
  printf '%s\n' "$out" > .impeccable/questions/answer.json
  printf 'EXIT %s\n' "$rc" >> .impeccable/questions/answer.json
  exit 0
done
printf 'LOOP TIMEOUT\n' > .impeccable/questions/answer.json
