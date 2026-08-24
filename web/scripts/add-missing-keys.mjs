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
    'By clicking sign in, you agree to our':
      'By clicking sign in, you agree to our',
    'By creating an account, you agree to our':
      'By creating an account, you agree to our',
    'Channel Status': 'Channel Status',
    'Channel monitoring status': 'Channel monitoring status',
    'View current availability across configured channels.':
      'View current availability across configured channels.',
    'Group ratio': 'Group ratio',
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
    'No channels match the selected status.':
      'No channels match the selected status.',
    'I have read and agree to the': 'I have read and agree to the',
    'Terms of Service': 'Terms of Service',
    'Usage Policy': 'Usage Policy',
    'Supported Countries and Regions': 'Supported Countries and Regions',
    'Service-Specific Terms': 'Service-Specific Terms',
    'Legal Documents': 'Legal Documents',
    Document: 'Document',
    'Content or URL': 'Content or URL',
    Action: 'Action',
    'Manage the links or content displayed for the four required legal documents.':
      'Manage the links or content displayed for the four required legal documents.',
    'Enter Markdown, HTML, or a full URL':
      'Enter Markdown, HTML, or a full URL',
    'Availability period': 'Availability period',
    '{{days}} days': '{{days}} days',
    '{{days}}-day availability': '{{days}}-day availability',
    'Channel details': 'Channel details',
    'Latest status': 'Latest status',
    'Latest latency (ms)': 'Latest latency (ms)',
    '7-day availability': '7-day availability',
    '15-day availability': '15-day availability',
    '30-day availability': '30-day availability',
    '7-day average latency (ms)': '7-day average latency (ms)',
  },
  zh: {
    'By clicking sign in, you agree to our': '点击登录即表示您同意',
    'By creating an account, you agree to our': '创建账户即表示您同意',
    'Channel Status': '渠道状态',
    'Channel monitoring status': '渠道监控状态',
    'View current availability across configured channels.':
      '查看已配置渠道的当前可用状态。',
    'Group ratio': '分组倍率',
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
    'No channels match the selected status.': '没有符合所选状态的渠道。',
    'I have read and agree to the': '我已阅读并同意',
    'Terms of Service': '服务条款',
    'Usage Policy': '使用政策',
    'Supported Countries and Regions': '支持的国家和地区',
    'Service-Specific Terms': '服务特定条款',
    'Legal Documents': '法律协议',
    Document: '协议',
    'Content or URL': '内容或 URL',
    Action: '操作',
    'Manage the links or content displayed for the four required legal documents.':
      '管理四项必需法律协议显示的链接或内容。',
    'Enter Markdown, HTML, or a full URL': '输入 Markdown、HTML 或完整 URL',
    'Availability period': '可用率周期',
    '{{days}} days': '{{days}} 天',
    '{{days}}-day availability': '{{days}} 天可用率',
    'Channel details': '渠道详情',
    'Latest status': '最新状态',
    'Latest latency (ms)': '最新延迟（ms）',
    '7-day availability': '7 天可用率',
    '15-day availability': '15 天可用率',
    '30-day availability': '30 天可用率',
    '7-day average latency (ms)': '7 天平均延迟（ms）',
  },
  'zh-TW': {
    'By clicking sign in, you agree to our': '點擊登入即表示您同意',
    'By creating an account, you agree to our': '建立帳戶即表示您同意',
    'Channel Status': '渠道狀態',
    'Channel monitoring status': '渠道監控狀態',
    'View current availability across configured channels.':
      '查看已設定渠道目前的可用狀態。',
    'Group ratio': '分組倍率',
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
    'No channels match the selected status.': '沒有符合所選狀態的渠道。',
    'I have read and agree to the': '我已閱讀並同意',
    'Terms of Service': '服務條款',
    'Usage Policy': '使用政策',
    'Supported Countries and Regions': '支援的國家和地區',
    'Service-Specific Terms': '服務特定條款',
    'Legal Documents': '法律協議',
    Document: '協議',
    'Content or URL': '內容或 URL',
    Action: '操作',
    'Manage the links or content displayed for the four required legal documents.':
      '管理四項必要法律協議顯示的連結或內容。',
    'Enter Markdown, HTML, or a full URL': '輸入 Markdown、HTML 或完整 URL',
    'Availability period': '可用率週期',
    '{{days}} days': '{{days}} 天',
    '{{days}}-day availability': '{{days}} 天可用率',
    'Channel details': '渠道詳情',
    'Latest status': '最新狀態',
    'Latest latency (ms)': '最新延遲（ms）',
    '7-day availability': '7 天可用率',
    '15-day availability': '15 天可用率',
    '30-day availability': '30 天可用率',
    '7-day average latency (ms)': '7 天平均延遲（ms）',
  },
  fr: {
    'By clicking sign in, you agree to our':
      'En cliquant sur « Se connecter », vous acceptez',
    'By creating an account, you agree to our':
      'En créant un compte, vous acceptez',
    'Channel Status': 'Statut des canaux',
    'Channel monitoring status': 'Statut de la surveillance des canaux',
    'View current availability across configured channels.':
      'Consultez la disponibilité actuelle des canaux configurés.',
    'Group ratio': 'Ratio de groupe',
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
    'No channels match the selected status.':
      'Aucun canal ne correspond au statut sélectionné.',
    'I have read and agree to the': "J'ai lu et j'accepte",
    'Terms of Service': "Conditions d'utilisation",
    'Usage Policy': "Politique d'utilisation",
    'Supported Countries and Regions': 'Pays et régions pris en charge',
    'Service-Specific Terms': 'Conditions spécifiques au service',
    'Legal Documents': 'Documents juridiques',
    Document: 'Document',
    'Content or URL': 'Contenu ou URL',
    Action: 'Action',
    'Manage the links or content displayed for the four required legal documents.':
      'Gérez les liens ou le contenu des quatre documents juridiques requis.',
    'Enter Markdown, HTML, or a full URL':
      'Saisissez du Markdown, du HTML ou une URL complète',
    'Availability period': 'Période de disponibilité',
    '{{days}} days': '{{days}} jours',
    '{{days}}-day availability': 'Disponibilité sur {{days}} jours',
    'Channel details': 'Détails du canal',
    'Latest status': 'Dernier état',
    'Latest latency (ms)': 'Dernière latence (ms)',
    '7-day availability': 'Disponibilité sur 7 jours',
    '15-day availability': 'Disponibilité sur 15 jours',
    '30-day availability': 'Disponibilité sur 30 jours',
    '7-day average latency (ms)': 'Latence moyenne sur 7 jours (ms)',
  },
  ja: {
    'By clicking sign in, you agree to our':
      'ログインをクリックすると、次に同意したものとみなされます：',
    'By creating an account, you agree to our':
      'アカウントを作成すると、次に同意したものとみなされます：',
    'Channel Status': 'チャネル状態',
    'Channel monitoring status': 'チャネル監視のステータス',
    'View current availability across configured channels.':
      '設定済みチャネルの現在の稼働状況を確認します。',
    'Group ratio': 'グループ倍率',
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
    'No channels match the selected status.':
      '選択したステータスに一致するチャネルはありません。',
    'I have read and agree to the': '以下を読み、同意します：',
    'Terms of Service': '利用規約',
    'Usage Policy': '利用ポリシー',
    'Supported Countries and Regions': '対応国・地域',
    'Service-Specific Terms': 'サービス固有の規約',
    'Legal Documents': '法的文書',
    Document: '文書',
    'Content or URL': 'コンテンツまたはURL',
    Action: '操作',
    'Manage the links or content displayed for the four required legal documents.':
      '4つの必須法的文書に表示するリンクまたはコンテンツを管理します。',
    'Enter Markdown, HTML, or a full URL':
      'Markdown、HTML、または完全なURLを入力',
    'Availability period': '可用性の期間',
    '{{days}} days': '{{days}}日',
    '{{days}}-day availability': '{{days}}日間の可用性',
    'Channel details': 'チャネルの詳細',
    'Latest status': '最新状態',
    'Latest latency (ms)': '最新レイテンシ (ms)',
    '7-day availability': '7日間の可用性',
    '15-day availability': '15日間の可用性',
    '30-day availability': '30日間の可用性',
    '7-day average latency (ms)': '7日間の平均レイテンシ (ms)',
  },
  ru: {
    'By clicking sign in, you agree to our':
      'Нажимая «Войти», вы соглашаетесь с',
    'By creating an account, you agree to our':
      'Создавая аккаунт, вы соглашаетесь с',
    'Channel Status': 'Состояние каналов',
    'Channel monitoring status': 'Статус мониторинга каналов',
    'View current availability across configured channels.':
      'Просматривайте текущую доступность настроенных каналов.',
    'Group ratio': 'Коэффициент группы',
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
    'No channels match the selected status.':
      'Нет каналов, соответствующих выбранному статусу.',
    'I have read and agree to the': 'Я прочитал(а) и принимаю',
    'Terms of Service': 'Условия использования',
    'Usage Policy': 'Политика использования',
    'Supported Countries and Regions': 'Поддерживаемые страны и регионы',
    'Service-Specific Terms': 'Особые условия сервиса',
    'Legal Documents': 'Юридические документы',
    Document: 'Документ',
    'Content or URL': 'Содержимое или URL',
    Action: 'Действие',
    'Manage the links or content displayed for the four required legal documents.':
      'Управляйте ссылками или содержимым четырех обязательных юридических документов.',
    'Enter Markdown, HTML, or a full URL':
      'Введите Markdown, HTML или полный URL',
    'Availability period': 'Период доступности',
    '{{days}} days': '{{days}} дн.',
    '{{days}}-day availability': 'Доступность за {{days}} дн.',
    'Channel details': 'Сведения о канале',
    'Latest status': 'Последний статус',
    'Latest latency (ms)': 'Последняя задержка (мс)',
    '7-day availability': 'Доступность за 7 дн.',
    '15-day availability': 'Доступность за 15 дн.',
    '30-day availability': 'Доступность за 30 дн.',
    '7-day average latency (ms)': 'Средняя задержка за 7 дн. (мс)',
  },
  vi: {
    'By clicking sign in, you agree to our':
      'Bằng cách nhấp vào đăng nhập, bạn đồng ý với',
    'By creating an account, you agree to our':
      'Bằng cách tạo tài khoản, bạn đồng ý với',
    'Channel Status': 'Trạng thái kênh',
    'Channel monitoring status': 'Trạng thái giám sát kênh',
    'View current availability across configured channels.':
      'Xem trạng thái khả dụng hiện tại của các kênh đã cấu hình.',
    'Group ratio': 'Hệ số nhóm',
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
    'No channels match the selected status.':
      'Không có kênh nào khớp với trạng thái đã chọn.',
    'I have read and agree to the': 'Tôi đã đọc và đồng ý với',
    'Terms of Service': 'Điều khoản dịch vụ',
    'Usage Policy': 'Chính sách sử dụng',
    'Supported Countries and Regions': 'Các quốc gia và khu vực được hỗ trợ',
    'Service-Specific Terms': 'Điều khoản riêng của dịch vụ',
    'Legal Documents': 'Tài liệu pháp lý',
    Document: 'Tài liệu',
    'Content or URL': 'Nội dung hoặc URL',
    Action: 'Thao tác',
    'Manage the links or content displayed for the four required legal documents.':
      'Quản lý liên kết hoặc nội dung hiển thị cho bốn tài liệu pháp lý bắt buộc.',
    'Enter Markdown, HTML, or a full URL':
      'Nhập Markdown, HTML hoặc URL đầy đủ',
    'Availability period': 'Khoảng thời gian khả dụng',
    '{{days}} days': '{{days}} ngày',
    '{{days}}-day availability': 'Khả dụng trong {{days}} ngày',
    'Channel details': 'Chi tiết kênh',
    'Latest status': 'Trạng thái mới nhất',
    'Latest latency (ms)': 'Độ trễ mới nhất (ms)',
    '7-day availability': 'Khả dụng 7 ngày',
    '15-day availability': 'Khả dụng 15 ngày',
    '30-day availability': 'Khả dụng 30 ngày',
    '7-day average latency (ms)': 'Độ trễ trung bình 7 ngày (ms)',
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
