#!/usr/bin/env bash

set -euo pipefail

readonly SCRIPT_NAME="git-account-switch"

usage() {
  cat <<'EOF'
Usage:
  scripts/git-account-switch.sh install
  scripts/git-account-switch.sh [miceplanscom-lab|hjy080530]

Without an account argument, select an account interactively.
EOF
}

fail() {
  printf '%s\n' "$SCRIPT_NAME: $*" >&2
  exit 1
}

account_name=""
account_email=""

set_account_profile() {
  case "$1" in
    miceplanscom-lab)
      account_name="miceplanscom-lab"
      account_email="miceplans.com@gmail.com"
      ;;
    hjy080530)
      account_name="hjy080530"
      account_email="bomaye119@gmail.com"
      ;;
    *)
      fail "지원하지 않는 계정입니다: $1"
      ;;
  esac
}

install_alias() {
  local script_path escaped_path
  script_path="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/$(basename "${BASH_SOURCE[0]}")"
  escaped_path="${script_path//\'/\'\\\'\'}"

  git config --global alias.aitubswitch "!f() { '$escaped_path' \"\$@\"; }; f"
  printf '설치 완료: git aitubswitch [miceplanscom-lab|hjy080530]\n'
}

restore_git_value() {
  local key="$1"
  local exists="$2"
  local value="$3"

  if [[ "$exists" == "true" ]]; then
    git config --global "$key" "$value"
  else
    git config --global --unset-all "$key" >/dev/null 2>&1 || true
  fi
}

capture_git_value() {
  local key="$1"
  local value

  if value="$(git config --global --get "$key")"; then
    printf 'true\n%s' "$value"
  else
    printf 'false\n'
  fi
}

if [[ "${1:-}" == "install" ]]; then
  [[ $# -eq 1 ]] || { usage >&2; exit 1; }
  install_alias
  exit 0
fi

if [[ $# -gt 1 ]]; then
  usage >&2
  exit 1
fi

if [[ $# -eq 1 ]]; then
  selected_account="$1"
else
  [[ -t 0 ]] || fail "계정을 인자로 지정하세요. 예: git aitubswitch miceplanscom-lab"
  printf '전환할 GitHub 계정을 선택하세요:\n1) miceplanscom-lab\n2) hjy080530\n> '
  read -r selection
  case "$selection" in
    1) selected_account="miceplanscom-lab" ;;
    2) selected_account="hjy080530" ;;
    *) fail "1 또는 2를 선택하세요." ;;
  esac
fi

set_account_profile "$selected_account"
command -v gh >/dev/null 2>&1 || fail "GitHub CLI(gh)가 필요합니다."

previous_account="$(gh api user --jq .login)" || fail "현재 GitHub CLI 인증을 확인할 수 없습니다. gh auth login을 먼저 실행하세요."

gh auth switch --hostname github.com --user "$account_name" >/dev/null || fail "GitHub 계정 전환에 실패했습니다."

active_account="$(gh api user --jq .login)" || {
  gh auth switch --hostname github.com --user "$previous_account" >/dev/null 2>&1 || true
  fail "전환한 GitHub CLI 인증을 확인할 수 없습니다. Git 작성자 설정은 유지했습니다."
}

if [[ "$active_account" != "$account_name" ]]; then
  gh auth switch --hostname github.com --user "$previous_account" >/dev/null 2>&1 || true
  fail "요청한 계정이 활성화되지 않았습니다. Git 작성자 설정은 유지했습니다."
fi

git_name_snapshot="$(capture_git_value user.name)"
git_email_snapshot="$(capture_git_value user.email)"
git_name_exists="${git_name_snapshot%%$'\n'*}"
git_name_value="${git_name_snapshot#*$'\n'}"
git_email_exists="${git_email_snapshot%%$'\n'*}"
git_email_value="${git_email_snapshot#*$'\n'}"

if ! git config --global user.name "$account_name" || ! git config --global user.email "$account_email"; then
  restore_git_value user.name "$git_name_exists" "$git_name_value"
  restore_git_value user.email "$git_email_exists" "$git_email_value"
  fail "Git 작성자 설정 갱신에 실패했습니다. 기존 설정으로 복구했습니다."
fi

printf '활성 GitHub 계정과 Git 작성자를 %s <%s>로 설정했습니다.\n' "$account_name" "$account_email"
