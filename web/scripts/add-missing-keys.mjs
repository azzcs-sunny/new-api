/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import fs from 'node:fs/promises'
import path from 'node:path'

const LOCALES_DIR = path.resolve('src/i18n/locales')

function stableStringify(obj) {
  return JSON.stringify(obj, null, 2) + '\n'
}

const newKeys = {
  en: {
    'Channel Status': 'Channel Status',
    'Refresh channel status': 'Refresh channel status',
    Degraded: 'Degraded',
    'Last 60 tests': 'Last 60 tests',
    'Pay {{amount}}': 'Pay {{amount}}',
    'Pay {{discountRate}}/10 of the original price':
      'Pay {{discountRate}}/10 of the original price',
    'Save {{amount}}': 'Save {{amount}}',
    '{{discount}}% OFF': '{{discount}}% OFF',
    '{{success}} successful, {{failed}} failed':
      '{{success}} successful, {{failed}} failed',
    'No channel test data is available yet.':
      'No channel test data is available yet.',
  },
  zh: {
    'Channel Status': '渠道状态',
    'Refresh channel status': '刷新渠道状态',
    Degraded: '降级',
    'Last 60 tests': '最近 60 次测速',
    'Pay {{amount}}': '实付 {{amount}}',
    'Pay {{discountRate}}/10 of the original price': '{{discountRate}}折',
    'Save {{amount}}': '省 {{amount}}',
    '{{discount}}% OFF': '立减 {{discount}}%',
    '{{success}} successful, {{failed}} failed':
      '成功 {{success}} 次，失败 {{failed}} 次',
    'No channel test data is available yet.': '暂无渠道测速数据。',
  },
  'zh-TW': {
    'Channel Status': '渠道狀態',
    'Refresh channel status': '重新整理渠道狀態',
    Degraded: '降級',
    'Last 60 tests': '最近 60 次測速',
    'Pay {{amount}}': '支付 {{amount}}',
    'Pay {{discountRate}}/10 of the original price':
      '支付原價的 {{discountRate}}/10',
    'Save {{amount}}': '節省 {{amount}}',
    '{{discount}}% OFF': '立減 {{discount}}%',
    '{{success}} successful, {{failed}} failed':
      '成功 {{success}} 次，失敗 {{failed}} 次',
    'No channel test data is available yet.': '尚無渠道測速資料。',
  },
  fr: {
    'Channel Status': 'Statut des canaux',
    'Refresh channel status': 'Actualiser le statut des canaux',
    Degraded: 'Dégradé',
    'Last 60 tests': '60 derniers tests',
    'Pay {{amount}}': 'Payer {{amount}}',
    'Pay {{discountRate}}/10 of the original price':
      'Payer {{discountRate}}/10 du prix initial',
    'Save {{amount}}': 'Économisez {{amount}}',
    '{{discount}}% OFF': '-{{discount}} %',
    '{{success}} successful, {{failed}} failed':
      '{{success}} réussies, {{failed}} échouées',
    'No channel test data is available yet.':
      "Aucune donnée de test de canal n'est encore disponible.",
  },
  ja: {
    'Channel Status': 'チャネル状態',
    'Refresh channel status': 'チャネル状態を更新',
    Degraded: '性能低下',
    'Last 60 tests': '直近60回のテスト',
    'Pay {{amount}}': 'お支払い {{amount}}',
    'Pay {{discountRate}}/10 of the original price':
      '元値の{{discountRate}}/10を支払う',
    'Save {{amount}}': '{{amount}} お得',
    '{{discount}}% OFF': '{{discount}}% オフ',
    '{{success}} successful, {{failed}} failed':
      '成功 {{success}} 回、失敗 {{failed}} 回',
    'No channel test data is available yet.':
      'チャネルテストデータはまだありません。',
  },
  ru: {
    'Channel Status': 'Состояние каналов',
    'Refresh channel status': 'Обновить состояние каналов',
    Degraded: 'Работает с перебоями',
    'Last 60 tests': 'Последние 60 проверок',
    'Pay {{amount}}': 'К оплате {{amount}}',
    'Pay {{discountRate}}/10 of the original price':
      'Оплатить {{discountRate}}/10 первоначальной цены',
    'Save {{amount}}': 'Экономия {{amount}}',
    '{{discount}}% OFF': 'Скидка {{discount}}%',
    '{{success}} successful, {{failed}} failed':
      'Успешно: {{success}}, с ошибкой: {{failed}}',
    'No channel test data is available yet.':
      'Данные проверки каналов пока отсутствуют.',
  },
  vi: {
    'Channel Status': 'Trạng thái kênh',
    'Refresh channel status': 'Làm mới trạng thái kênh',
    Degraded: 'Suy giảm',
    'Last 60 tests': '60 lần kiểm tra gần nhất',
    'Pay {{amount}}': 'Thanh toán {{amount}}',
    'Pay {{discountRate}}/10 of the original price':
      'Trả {{discountRate}}/10 giá gốc',
    'Save {{amount}}': 'Tiết kiệm {{amount}}',
    '{{discount}}% OFF': 'Giảm {{discount}}%',
    '{{success}} successful, {{failed}} failed':
      '{{success}} thành công, {{failed}} thất bại',
    'No channel test data is available yet.': 'Chưa có dữ liệu kiểm tra kênh.',
  },
}

async function main() {
  let totalAdded = 0

  for (const [locale, trans] of Object.entries(newKeys)) {
    const filePath = path.join(LOCALES_DIR, `${locale}.json`)
    const json = JSON.parse(await fs.readFile(filePath, 'utf8'))

    let count = 0
    for (const [key, value] of Object.entries(trans)) {
      if (!Object.prototype.hasOwnProperty.call(json.translation, key)) {
        json.translation[key] = value
        count++
      } else if (json.translation[key] !== value) {
        json.translation[key] = value
        count++
      }
    }
    if (count > 0) {
      json.translation = Object.fromEntries(
        Object.entries(json.translation).sort(([a], [b]) => a.localeCompare(b))
      )
      await fs.writeFile(filePath, stableStringify(json), 'utf8')
    }

    console.log(`${locale}: ${count} translations applied`)
    totalAdded += count
  }

  console.log(`\nTotal: ${totalAdded} translations applied`)
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
