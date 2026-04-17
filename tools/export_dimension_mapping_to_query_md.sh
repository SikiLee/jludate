#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUTPUT_PATH="${1:-${ROOT_DIR}/query.md}"
TMP_FILE="$(mktemp)"

cleanup() {
  rm -f "${TMP_FILE}"
}
trap cleanup EXIT

docker compose exec -T db psql -U user -d survey_db -At -F $'\t' -c \
  "SELECT question_number, section_title, question_text FROM unidate_app.survey_questions ORDER BY question_number ASC;" \
  > "${TMP_FILE}"

awk -F '\t' -v now="$(date '+%Y-%m-%d %H:%M:%S %Z')" '
function print_question_list(label, list,   items, count, i, n, text) {
  print "### " label;
  split(list, items, ",");
  count = length(items);
  for (i = 1; i <= count; i += 1) {
    n = items[i] + 0;
    text = question_text[n];
    if (text == "") {
      text = "[题目不存在]";
    }
    print "- Q" n "：" text;
  }
  print "";
}

function print_dimension(title, alias_name, positive_list, reverse_list) {
  print "## " title "（" alias_name "）";
  print "";
  print_question_list("正向题", positive_list);
  print_question_list("反向题", reverse_list);
}

BEGIN {
  print "# 维度题目映射表（自动导出）";
  print "";
  print "- 生成时间: " now;
  print "- 数据来源: survey_db.unidate_app.survey_questions";
  print "";
}

{
  question_number = $1 + 0;
  question_text[question_number] = $3;
}

END {
  print_dimension("维度 1：人生轨迹", "A 探索者 vs B 筑巢者", "2,6,8,9,10,15,19,49,50", "1,3");
  print_dimension("维度 2：情感沟通", "C 直球派 vs G 温和派", "4,22,23,24,27", "21,25,29");
  print_dimension("维度 3：亲密边界", "I 独立型 vs S 共生型", "12,30,31,36", "26,32,33,34,35,38,39");
  print_dimension("维度 4：价值底线", "R 原则型 vs F 变通型", "5,13,14,16,20,28,37,41,42,43,47,48", "7,11,17,18,40,44,45,46");
}
' "${TMP_FILE}" > "${OUTPUT_PATH}"

echo "已导出到: ${OUTPUT_PATH}"
