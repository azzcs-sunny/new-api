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
    '15 days': '15 days',
    '24 hours': '24 hours',
    '7 days': '7 days',
    '30 days': '30 days',
    'Channel Status': 'Channel Status',
    'Last 24 hours': 'Last 24 hours',
    'Last 7 days': 'Last 7 days',
    'Last 30 days': 'Last 30 days',
    'Refresh channel status': 'Refresh channel status',
    'No channel status data is available for this period.':
      'No channel status data is available for this period.',
    'Service trend': 'Service trend',
    History: 'History',
    Operational: 'Operational',
    Degraded: 'Degraded',
    Unavailable: 'Unavailable',
    'All providers': 'All providers',
    'All groups': 'All groups',
    'All models': 'All models',
    'Channel combinations': 'Channel combinations',
    'Limited to 200 rows': 'Limited to 200 rows',
    Availability: 'Availability',
    'Conversation latency': 'Conversation latency',
    'Last 60 uses': 'Last 60 uses',
    'Node PING': 'Node PING',
    Now: 'Now',
    Past: 'Past',
    'Refreshes in {{seconds}}s': 'Refreshes in {{seconds}}s',
    'Pay {{amount}}': 'Pay {{amount}}',
    'Pay {{discountRate}}/10 of the original price':
      'Pay {{discountRate}}/10 of the original price',
    'Save {{amount}}': 'Save {{amount}}',
    '{{discount}}% OFF': '{{discount}}% OFF',
    '{{success}} successful, {{failed}} failed':
      '{{success}} successful, {{failed}} failed',
  },
  zh: {
    '15 days': '15 天',
    '24 hours': '24 小时',
    '7 days': '7 天',
    '30 days': '30 天',
    'Channel Status': '渠道状态',
    'Last 24 hours': '最近 24 小时',
    'Last 7 days': '最近 7 天',
    'Last 30 days': '最近 30 天',
    'Refresh channel status': '刷新渠道状态',
    'No channel status data is available for this period.':
      '此时间段暂无渠道状态数据。',
    'Service trend': '服务趋势',
    History: '历史',
    Operational: '运行正常',
    Degraded: '性能下降',
    Unavailable: '不可用',
    'All providers': '全部供应商',
    'All groups': '全部分组',
    'All models': '全部模型',
    'Channel combinations': '渠道组合',
    'Limited to 200 rows': '最多显示 200 行',
    Availability: '可用性',
    'Conversation latency': '对话延迟',
    'Last 60 uses': '最近 60 次使用',
    'Node PING': '节点 PING',
    Now: '现在',
    Past: '过去',
    'Refreshes in {{seconds}}s': '{{seconds}} 秒后刷新',
    'Pay {{amount}}': '实付 {{amount}}',
    'Pay {{discountRate}}/10 of the original price': '{{discountRate}}折',
    'Save {{amount}}': '省 {{amount}}',
    '{{discount}}% OFF': '立减 {{discount}}%',
    '{{success}} successful, {{failed}} failed':
      '成功 {{success}} 次，失败 {{failed}} 次',
  },
  'zh-TW': {
    '15 days': '15 天',
    '24 hours': '24 小時',
    '7 days': '7 天',
    '30 days': '30 天',
    'Channel Status': '渠道狀態',
    'Last 24 hours': '最近 24 小時',
    'Last 7 days': '最近 7 天',
    'Last 30 days': '最近 30 天',
    'Refresh channel status': '重新整理渠道狀態',
    'No channel status data is available for this period.':
      '此時段暫無渠道狀態資料。',
    'Service trend': '服務趨勢',
    History: '歷史',
    Operational: '運作正常',
    Degraded: '效能下降',
    Unavailable: '無法使用',
    'All providers': '所有供應商',
    'All groups': '所有分組',
    'All models': '所有模型',
    'Channel combinations': '渠道組合',
    'Limited to 200 rows': '最多顯示 200 列',
    Availability: '可用性',
    'Conversation latency': '對話延遲',
    'Last 60 uses': '最近 60 次使用',
    'Node PING': '節點 PING',
    Now: '現在',
    Past: '過去',
    'Refreshes in {{seconds}}s': '{{seconds}} 秒後重新整理',
    'Pay {{amount}}': '支付 {{amount}}',
    'Pay {{discountRate}}/10 of the original price':
      '支付原價的 {{discountRate}}/10',
    'Save {{amount}}': '節省 {{amount}}',
    '{{discount}}% OFF': '立減 {{discount}}%',
    '{{success}} successful, {{failed}} failed':
      '成功 {{success}} 次，失敗 {{failed}} 次',
  },
  fr: {
    '15 days': '15 jours',
    '24 hours': '24 heures',
    '7 days': '7 jours',
    '30 days': '30 jours',
    'Channel Status': 'Statut des canaux',
    'Last 24 hours': 'Dernières 24 heures',
    'Last 7 days': '7 derniers jours',
    'Last 30 days': '30 derniers jours',
    'Refresh channel status': 'Actualiser le statut des canaux',
    'No channel status data is available for this period.':
      'Aucune donnée d’état des canaux n’est disponible pour cette période.',
    'Service trend': 'Tendance du service',
    History: 'Historique',
    Operational: 'Opérationnel',
    Degraded: 'Dégradé',
    Unavailable: 'Indisponible',
    'All providers': 'Tous les fournisseurs',
    'All groups': 'Tous les groupes',
    'All models': 'Tous les modèles',
    'Channel combinations': 'Combinaisons de canaux',
    'Limited to 200 rows': 'Limité à 200 lignes',
    Availability: 'Disponibilité',
    'Conversation latency': 'Latence de conversation',
    'Last 60 uses': '60 dernières utilisations',
    'Node PING': 'PING du nœud',
    Now: 'Maintenant',
    Past: 'Passé',
    'Refreshes in {{seconds}}s': 'Actualisation dans {{seconds}} s',
    'Pay {{amount}}': 'Payer {{amount}}',
    'Pay {{discountRate}}/10 of the original price':
      'Payer {{discountRate}}/10 du prix initial',
    'Save {{amount}}': 'Économisez {{amount}}',
    '{{discount}}% OFF': '-{{discount}} %',
    '{{success}} successful, {{failed}} failed':
      '{{success}} réussies, {{failed}} échouées',
  },
  ja: {
    '15 days': '15日間',
    '24 hours': '24時間',
    '7 days': '7日間',
    '30 days': '30日間',
    'Channel Status': 'チャネル状態',
    'Last 24 hours': '過去 24 時間',
    'Last 7 days': '過去 7 日間',
    'Last 30 days': '過去 30 日間',
    'Refresh channel status': 'チャネル状態を更新',
    'No channel status data is available for this period.':
      'この期間のチャネル状態データはありません。',
    'Service trend': 'サービスの推移',
    History: '履歴',
    Operational: '正常稼働',
    Degraded: '性能低下',
    Unavailable: '利用不可',
    'All providers': 'すべてのプロバイダー',
    'All groups': 'すべてのグループ',
    'All models': 'すべてのモデル',
    'Channel combinations': 'チャネルの組み合わせ',
    'Limited to 200 rows': '最大 200 行を表示',
    Availability: '可用性',
    'Conversation latency': '対話レイテンシ',
    'Last 60 uses': '直近 60 回の使用',
    'Node PING': 'ノード PING',
    Now: '現在',
    Past: '過去',
    'Refreshes in {{seconds}}s': '{{seconds}}秒後に更新',
    'Pay {{amount}}': 'お支払い {{amount}}',
    'Pay {{discountRate}}/10 of the original price':
      '元値の{{discountRate}}/10を支払う',
    'Save {{amount}}': '{{amount}} お得',
    '{{discount}}% OFF': '{{discount}}% オフ',
    '{{success}} successful, {{failed}} failed':
      '成功 {{success}} 回、失敗 {{failed}} 回',
  },
  ru: {
    '15 days': '15 дней',
    '24 hours': '24 часа',
    '7 days': '7 дней',
    '30 days': '30 дней',
    'Channel Status': 'Состояние каналов',
    'Last 24 hours': 'Последние 24 часа',
    'Last 7 days': 'Последние 7 дней',
    'Last 30 days': 'Последние 30 дней',
    'Refresh channel status': 'Обновить состояние каналов',
    'No channel status data is available for this period.':
      'За этот период нет данных о состоянии каналов.',
    'Service trend': 'Динамика сервиса',
    History: 'История',
    Operational: 'Работает',
    Degraded: 'Работает с перебоями',
    Unavailable: 'Недоступен',
    'All providers': 'Все провайдеры',
    'All groups': 'Все группы',
    'All models': 'Все модели',
    'Channel combinations': 'Комбинации каналов',
    'Limited to 200 rows': 'Показано не более 200 строк',
    Availability: 'Доступность',
    'Conversation latency': 'Задержка диалога',
    'Last 60 uses': 'Последние 60 использований',
    'Node PING': 'PING узла',
    Now: 'Сейчас',
    Past: 'Ранее',
    'Refreshes in {{seconds}}s': 'Обновление через {{seconds}} с',
    'Pay {{amount}}': 'К оплате {{amount}}',
    'Pay {{discountRate}}/10 of the original price':
      'Оплатить {{discountRate}}/10 первоначальной цены',
    'Save {{amount}}': 'Экономия {{amount}}',
    '{{discount}}% OFF': 'Скидка {{discount}}%',
    '{{success}} successful, {{failed}} failed':
      'Успешно: {{success}}, с ошибкой: {{failed}}',
  },
  vi: {
    '15 days': '15 ngày',
    '24 hours': '24 giờ',
    '7 days': '7 ngày',
    '30 days': '30 ngày',
    'Channel Status': 'Trạng thái kênh',
    'Last 24 hours': '24 giờ qua',
    'Last 7 days': '7 ngày qua',
    'Last 30 days': '30 ngày qua',
    'Refresh channel status': 'Làm mới trạng thái kênh',
    'No channel status data is available for this period.':
      'Không có dữ liệu trạng thái kênh trong khoảng thời gian này.',
    'Service trend': 'Xu hướng dịch vụ',
    History: 'Lịch sử',
    Operational: 'Hoạt động bình thường',
    Degraded: 'Suy giảm',
    Unavailable: 'Không khả dụng',
    'All providers': 'Tất cả nhà cung cấp',
    'All groups': 'Tất cả nhóm',
    'All models': 'Tất cả mô hình',
    'Channel combinations': 'Tổ hợp kênh',
    'Limited to 200 rows': 'Giới hạn 200 hàng',
    Availability: 'Độ khả dụng',
    'Conversation latency': 'Độ trễ hội thoại',
    'Last 60 uses': '60 lần sử dụng gần nhất',
    'Node PING': 'PING nút',
    Now: 'Hiện tại',
    Past: 'Trước đây',
    'Refreshes in {{seconds}}s': 'Làm mới sau {{seconds}} giây',
    'Pay {{amount}}': 'Thanh toán {{amount}}',
    'Pay {{discountRate}}/10 of the original price':
      'Trả {{discountRate}}/10 giá gốc',
    'Save {{amount}}': 'Tiết kiệm {{amount}}',
    '{{discount}}% OFF': 'Giảm {{discount}}%',
    '{{success}} successful, {{failed}} failed':
      '{{success}} thành công, {{failed}} thất bại',
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
