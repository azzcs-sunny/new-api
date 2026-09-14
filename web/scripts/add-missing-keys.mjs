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
    Title: 'Title',
    'Enter announcement title': 'Enter announcement title',
    'Title is required': 'Title is required',
    'Title must be at most 100 characters':
      'Title must be at most 100 characters',
    'Open in new window': 'Open in new window',
    '⭐Purchase Card Codes⭐': '⭐Purchase Card Codes⭐',
    'Top-up link is not configured': 'Top-up link is not configured',
    'Administrator adjustment': 'Administrator adjustment',
    'Administrator balance update': 'Administrator balance update',
    'Administrator credit': 'Administrator credit',
    'Administrator deduction': 'Administrator deduction',
    'Balance changes will appear here after a top-up, redemption, or administrator update.':
      'Balance changes will appear here after a top-up, redemption, or administrator update.',
    'Balance History': 'Balance History',
    'Failed to load balance history': 'Failed to load balance history',
    'No balance changes yet': 'No balance changes yet',
    'Online top-up': 'Online top-up',
    'Review every balance change from payments, redemption codes, and administrator updates.':
      'Review every balance change from payments, redemption codes, and administrator updates.',
    'Amount Earned': 'Amount Earned',
    'Credited Amount': 'Credited Amount',
    'Earned At': 'Earned At',
    'Earning Details': 'Earning Details',
    'Failed to load details': 'Failed to load details',
    'Loading details': 'Loading details',
    'No earning details yet': 'No earning details yet',
    'Order Number': 'Order Number',
    'Top-up No.': 'Top-up No.',
    Frozen: 'Frozen',
    'Referral rewards cannot be withdrawn and can only be used on this platform.':
      'Referral rewards cannot be withdrawn and can only be used on this platform.',
    'Invited User ID': 'Invited User ID',
    'Referral Relations': 'Referral Relations',
    'Review all inviter and invitee bindings and rewards.':
      'Review all inviter and invitee bindings and rewards.',
    'Referral bindings and rewards will appear here after users join.':
      'Referral bindings and rewards will appear here after users join.',
    'Inviter ID': 'Inviter ID',
    'Inviter Username': 'Inviter Username',
    'Invitee ID': 'Invitee ID',
    'Invitee Username': 'Invitee Username',
    'No referral relations yet': 'No referral relations yet',
    'Frozen Reward': 'Frozen Reward',
    'Frozen Amount': 'Frozen Amount',
    'Reward Ratio': 'Reward Ratio',
    'New rewards remain frozen for 24 hours before they become available for transfer.':
      'New rewards remain frozen for 24 hours before they become available for transfer.',
    'Invited User': 'Invited User',
    'Joined At': 'Joined At',
    'Last Earned At': 'Last Earned At',
    'Last Reward': 'Last Reward',
    'Manage invited users and referral rewards.':
      'Manage invited users and referral rewards.',
    'No referred users yet': 'No referred users yet',
    'Share your referral link': 'Share your referral link',
    'Share your referral link to start earning rewards.':
      'Share your referral link to start earning rewards.',
    'The first three successful top-ups from each invited user earn a rebate.':
      'The first three successful top-ups from each invited user earn a rebate.',
    'Top-ups': 'Top-ups',
    'Reward Earned': 'Reward Earned',
    'Affiliate Reward Ratio': 'Affiliate Reward Ratio',
    'Fraction of each referred user top-up credited to the inviter (0-100%).':
      'Fraction of each referred user top-up credited to the inviter (0-100%).',
    'Only the first three successful top-ups are eligible.':
      'Only the first three successful top-ups are eligible.',
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
    GPT: 'GPT',
    'Chinese Models': 'Chinese Models',
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
    'Invoice file URL must use HTTPS': 'Invoice file URL must use HTTPS',
    'Invoice notice': 'Invoice notice',
    'This notice is shown to users above the invoice request form.':
      'This notice is shown to users above the invoice request form.',
    'Enter an optional notice for users': 'Enter an optional notice for users',
    'Invoice notice is too long': 'Invoice notice is too long',
    'Friendly reminder': 'Friendly reminder',
    'Export Excel': 'Export Excel',
    'Export invoice': 'Export invoice',
    'Export selected': 'Export selected',
    'Export order': 'Export order',
    'Export selected orders': 'Export selected orders',
    Export: 'Export',
    'Exporting...': 'Exporting...',
    'Failed to export invoices': 'Failed to export invoices',
    'Invoice ID': 'Invoice ID',
    'Issued at': 'Issued at',
    'No invoices to export': 'No invoices to export',
    'Submitted at': 'Submitted at',
    'Top-up orders': 'Top-up orders',
    'Submit and review invoice requests.':
      'Submit and review invoice requests.',
    'Invoice sent to your email': 'Invoice sent to your email',
    'The invoice will be sent to this email address.':
      'The invoice will be sent to this email address.',
    'Invoice title': 'Invoice title',
    'Order IDs': 'Order IDs',
    Notes: 'Notes',
    'Invoice email is required': 'Invoice email is required',
    'Invalid invoice email address': 'Invalid invoice email address',
    'Invoice email delivery failed; the invoice remains processing':
      'Invoice email delivery failed; the invoice remains processing',
    'Invoice file is too large': 'Invoice file is too large',
    'Invoice file returned HTTP {{status}}':
      'Invoice file returned HTTP {{status}}',
    Invoiced: 'Invoiced',
    'Not invoiced': 'Not invoiced',
    'Mark as invoiced': 'Mark as invoiced',
    'Mark as not invoiced': 'Mark as not invoiced',
    'Order marked as invoiced': 'Order marked as invoiced',
    'Order marked as not invoiced': 'Order marked as not invoiced',
    'Failed to update invoice status': 'Failed to update invoice status',
    'This order will no longer be available for invoice requests.':
      'This order will no longer be available for invoice requests.',
    'This order will become available for invoice requests again.':
      'This order will become available for invoice requests again.',
  },
  zh: {
    Title: '标题',
    'Enter announcement title': '请输入公告标题',
    'Title is required': '标题为必填项',
    'Title must be at most 100 characters': '标题不能超过 100 个字符',
    'Open in new window': '新窗口打开',
    '⭐Purchase Card Codes⭐': '⭐购买卡密⭐',
    'Top-up link is not configured': '未配置充值链接',
    'Administrator adjustment': '管理员调整',
    'Administrator balance update': '管理员更新余额',
    'Administrator credit': '管理员增加额度',
    'Administrator deduction': '管理员扣减额度',
    'Balance changes will appear here after a top-up, redemption, or administrator update.':
      '在线充值、兑换码兑换或管理员调整后，余额变动将显示在这里。',
    'Balance History': '余额明细',
    'Failed to load balance history': '余额明细加载失败',
    'No balance changes yet': '暂无余额变动',
    'Online top-up': '在线充值',
    'Review every balance change from payments, redemption codes, and administrator updates.':
      '查看在线充值、兑换码和管理员调整产生的每笔余额变动。',
    'Amount Earned': '获得金额',
    'Credited Amount': '到账金额',
    'Earned At': '获得时间',
    'Earning Details': '获得明细',
    'Failed to load details': '明细加载失败',
    'Loading details': '正在加载明细',
    'No earning details yet': '暂无获得明细',
    'Order Number': '订单号',
    'Top-up No.': '充值序号',
    Frozen: '冻结中',
    'Referral rewards cannot be withdrawn and can only be used on this platform.':
      '邀请返利不能提现，仅限用于本平台消费。',
    'Invited User ID': '受邀用户 ID',
    'Referral Relations': '邀请关系',
    'Review all inviter and invitee bindings and rewards.':
      '查看所有邀请人与受邀人的绑定关系及返利。',
    'Referral bindings and rewards will appear here after users join.':
      '用户加入后，邀请绑定关系和返利将显示在这里。',
    'Inviter ID': '邀请人 ID',
    'Inviter Username': '邀请人用户名',
    'Invitee ID': '受邀用户 ID',
    'Invitee Username': '受邀用户用户名',
    'No referral relations yet': '暂无邀请关系',
    'Frozen Reward': '冻结返利',
    'Frozen Amount': '冻结金额',
    'Reward Ratio': '返利比例',
    'New rewards remain frozen for 24 hours before they become available for transfer.':
      '新产生的返利将冻结 24 小时，之后才可转入余额。',
    'Invited User': '受邀用户',
    'Joined At': '加入时间',
    'Last Earned At': '最近获得时间',
    'Last Reward': '最近返利',
    'Manage invited users and referral rewards.': '管理受邀用户和邀请返利。',
    'No referred users yet': '暂无受邀用户',
    'Share your referral link': '分享你的邀请链接',
    'Share your referral link to start earning rewards.':
      '分享邀请链接，开始赚取返利。',
    'The first three successful top-ups from each invited user earn a rebate.':
      '每位受邀用户的前三次成功充值可产生返利。',
    'Top-ups': '充值次数',
    'Reward Earned': '获得返利',
    'Affiliate Reward Ratio': '邀请返利比例',
    'Fraction of each referred user top-up credited to the inviter (0-100%).':
      '被邀请用户每次充值返给邀请人的比例（0-100%）。',
    'Only the first three successful top-ups are eligible.':
      '每个被邀请用户仅前三次成功充值可获得返利。',
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
    GPT: 'GPT',
    'Chinese Models': '国模',
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
    'Invoice file URL must use HTTPS': '发票文件链接必须使用 HTTPS',
    'Invoice notice': '发票说明',
    'This notice is shown to users above the invoice request form.':
      '此说明将显示在用户开票申请表单上方。',
    'Enter an optional notice for users': '输入可选的用户说明',
    'Invoice notice is too long': '发票说明过长',
    'Friendly reminder': '温馨提示',
    'Export Excel': '导出 Excel',
    'Export invoice': '导出发票',
    'Export selected': '导出已选',
    'Export order': '导出订单',
    'Export selected orders': '导出已选订单',
    Export: '导出',
    'Exporting...': '正在导出...',
    'Failed to export invoices': '导出发票失败',
    'Invoice ID': '发票 ID',
    'Issued at': '开票时间',
    'No invoices to export': '没有可导出的发票',
    'Submitted at': '申请时间',
    'Top-up orders': '关联充值订单',
    'Submit and review invoice requests.': '提交并查看发票申请。',
    'Invoice sent to your email': '发票已发送到您的邮箱',
    'The invoice will be sent to this email address.':
      '发票开具后将发送至此邮箱，请确认地址准确。',
    'Invoice title': '发票抬头',
    'Order IDs': '订单 ID',
    Notes: '备注',
    'Invoice email is required': '发票邮箱不能为空',
    'Invalid invoice email address': '发票邮箱格式无效',
    'Invoice email delivery failed; the invoice remains processing':
      '发票邮件发送失败，发票仍处于处理中',
    'Invoice file is too large': '发票文件过大',
    'Invoice file returned HTTP {{status}}': '发票文件返回 HTTP {{status}}',
    Invoiced: '已开票',
    'Not invoiced': '未开票',
    'Mark as invoiced': '标记为已开票',
    'Mark as not invoiced': '标记为未开票',
    'Order marked as invoiced': '订单已标记为已开票',
    'Order marked as not invoiced': '订单已标记为未开票',
    'Failed to update invoice status': '更新开票状态失败',
    'This order will no longer be available for invoice requests.':
      '该订单将不再提供给用户申请开票。',
    'This order will become available for invoice requests again.':
      '该订单将重新提供给用户申请开票。',
  },
  'zh-TW': {
    Title: '標題',
    'Enter announcement title': '請輸入公告標題',
    'Title is required': '標題為必填項',
    'Title must be at most 100 characters': '標題不能超過 100 個字元',
    'Open in new window': '在新視窗開啟',
    '⭐Purchase Card Codes⭐': '⭐購買卡密⭐',
    'Top-up link is not configured': '尚未設定充值連結',
    'Administrator adjustment': '管理員調整',
    'Administrator balance update': '管理員更新餘額',
    'Administrator credit': '管理員增加額度',
    'Administrator deduction': '管理員扣減額度',
    'Balance changes will appear here after a top-up, redemption, or administrator update.':
      '線上充值、兌換碼兌換或管理員調整後，餘額變動將顯示在這裡。',
    'Balance History': '餘額明細',
    'Failed to load balance history': '餘額明細載入失敗',
    'No balance changes yet': '暫無餘額變動',
    'Online top-up': '線上充值',
    'Review every balance change from payments, redemption codes, and administrator updates.':
      '查看線上充值、兌換碼和管理員調整產生的每筆餘額變動。',
    'Amount Earned': '獲得金額',
    'Credited Amount': '到賬金額',
    'Earned At': '獲得時間',
    'Earning Details': '獲得明細',
    'Failed to load details': '明細載入失敗',
    'Loading details': '正在載入明細',
    'No earning details yet': '暫無獲得明細',
    'Order Number': '訂單號',
    'Top-up No.': '充值序號',
    Frozen: '凍結中',
    'Referral rewards cannot be withdrawn and can only be used on this platform.':
      '邀請返利不能提现，僅限用於本平台消費。',
    'Invited User ID': '受邀用戶 ID',
    'Referral Relations': '邀請關係',
    'Review all inviter and invitee bindings and rewards.':
      '查看所有邀請人與受邀用戶的綁定關係及返利。',
    'Referral bindings and rewards will appear here after users join.':
      '用戶加入後，邀請綁定關係和返利將顯示在這裡。',
    'Inviter ID': '邀請人 ID',
    'Inviter Username': '邀請人用戶名',
    'Invitee ID': '受邀用戶 ID',
    'Invitee Username': '受邀用戶用戶名',
    'No referral relations yet': '暫無邀請關係',
    'Frozen Reward': '凍結返利',
    'Frozen Amount': '凍結金額',
    'Reward Ratio': '返利比例',
    'New rewards remain frozen for 24 hours before they become available for transfer.':
      '新產生的返利將凍結 24 小時，之後才可轉入餘額。',
    'Invited User': '受邀用戶',
    'Joined At': '加入時間',
    'Last Earned At': '最近獲得時間',
    'Last Reward': '最近返利',
    'Manage invited users and referral rewards.': '管理受邀用戶和邀請返利。',
    'No referred users yet': '暫無受邀用戶',
    'Share your referral link': '分享你的邀請連結',
    'Share your referral link to start earning rewards.':
      '分享邀請連結，開始賺取返利。',
    'The first three successful top-ups from each invited user earn a rebate.':
      '每位受邀用戶的前三次成功充值可產生返利。',
    'Top-ups': '充值次數',
    'Reward Earned': '獲得返利',
    'Affiliate Reward Ratio': '邀請返利比例',
    'Fraction of each referred user top-up credited to the inviter (0-100%).':
      '被邀請用戶每次充值返給邀請人的比例（0-100%）。',
    'Only the first three successful top-ups are eligible.':
      '每個被邀請用戶僅前三次成功充值可獲得返利。',
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
    GPT: 'GPT',
    'Chinese Models': '國模',
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
    'Invoice file URL must use HTTPS': '發票檔案連結必須使用 HTTPS',
    'Invoice notice': '發票說明',
    'This notice is shown to users above the invoice request form.':
      '此說明將顯示在使用者開票申請表單上方。',
    'Enter an optional notice for users': '輸入可選的使用者說明',
    'Invoice notice is too long': '發票說明過長',
    'Friendly reminder': '溫馨提示',
    'Export Excel': '匯出 Excel',
    'Export invoice': '匯出發票',
    'Export selected': '匯出已選',
    'Export order': '匯出訂單',
    'Export selected orders': '匯出已選訂單',
    Export: '匯出',
    'Exporting...': '正在匯出...',
    'Failed to export invoices': '匯出發票失敗',
    'Invoice ID': '發票 ID',
    'Issued at': '開票時間',
    'No invoices to export': '沒有可匯出的發票',
    'Submitted at': '申請時間',
    'Top-up orders': '關聯儲值訂單',
    'Submit and review invoice requests.': '提交並查看發票申請。',
    'Invoice sent to your email': '發票已寄送至您的電子郵件',
    'The invoice will be sent to this email address.':
      '發票開立後將寄送至此電子郵件，請確認地址正確。',
    'Invoice title': '發票抬頭',
    'Order IDs': '訂單 ID',
    Notes: '備註',
    'Invoice email is required': '發票電子郵件不可為空',
    'Invalid invoice email address': '發票電子郵件格式無效',
    'Invoice email delivery failed; the invoice remains processing':
      '發票郵件寄送失敗，發票仍在處理中',
    'Invoice file is too large': '發票檔案過大',
    'Invoice file returned HTTP {{status}}': '發票檔案回傳 HTTP {{status}}',
    Invoiced: '已開票',
    'Not invoiced': '未開票',
    'Mark as invoiced': '標記為已開票',
    'Mark as not invoiced': '標記為未開票',
    'Order marked as invoiced': '訂單已標記為已開票',
    'Order marked as not invoiced': '訂單已標記為未開票',
    'Failed to update invoice status': '更新開票狀態失敗',
    'This order will no longer be available for invoice requests.':
      '該訂單將不再提供給使用者申請開票。',
    'This order will become available for invoice requests again.':
      '該訂單將重新提供給使用者申請開票。',
  },
  fr: {
    Title: 'Titre',
    'Enter announcement title': 'Saisir le titre de l’annonce',
    'Title is required': 'Le titre est requis',
    'Title must be at most 100 characters':
      'Le titre doit contenir au maximum 100 caractères',
    'Open in new window': 'Ouvrir dans une nouvelle fenêtre',
    '⭐Purchase Card Codes⭐': '⭐Acheter des codes de recharge⭐',
    'Top-up link is not configured': 'Le lien de recharge n’est pas configuré',
    'Administrator adjustment': 'Ajustement administrateur',
    'Administrator balance update':
      'Mise à jour du solde par un administrateur',
    'Administrator credit': 'Crédit administrateur',
    'Administrator deduction': 'Déduction administrateur',
    'Balance changes will appear here after a top-up, redemption, or administrator update.':
      'Les changements de solde apparaîtront ici après une recharge, un code utilisé ou une mise à jour administrative.',
    'Balance History': 'Historique du solde',
    'Failed to load balance history':
      'Échec du chargement de l’historique du solde',
    'No balance changes yet': 'Aucun changement de solde',
    'Online top-up': 'Recharge en ligne',
    'Review every balance change from payments, redemption codes, and administrator updates.':
      'Consultez chaque changement de solde issu des paiements, codes de recharge et mises à jour administratives.',
    'Amount Earned': 'Montant gagné',
    'Credited Amount': 'Montant crédité',
    'Earned At': 'Date du gain',
    'Earning Details': 'Détails des gains',
    'Failed to load details': 'Échec du chargement des détails',
    'Loading details': 'Chargement des détails',
    'No earning details yet': 'Aucun détail de gain',
    'Order Number': 'Numéro de commande',
    'Top-up No.': 'N° de recharge',
    Frozen: 'Gelée',
    'Referral rewards cannot be withdrawn and can only be used on this platform.':
      'Les récompenses de parrainage ne peuvent pas être retirées et sont utilisables uniquement sur cette plateforme.',
    'Invited User ID': 'ID de l’utilisateur invité',
    'Referral Relations': 'Relations de parrainage',
    'Review all inviter and invitee bindings and rewards.':
      'Consultez tous les liens et récompenses entre parrains et invités.',
    'Referral bindings and rewards will appear here after users join.':
      'Les liens et récompenses apparaîtront ici après l’inscription des utilisateurs.',
    'Inviter ID': 'ID du parrain',
    'Inviter Username': 'Nom d’utilisateur du parrain',
    'Invitee ID': 'ID de l’invité',
    'Invitee Username': 'Nom d’utilisateur de l’invité',
    'No referral relations yet': 'Aucune relation de parrainage',
    'Frozen Reward': 'Récompense gelée',
    'Frozen Amount': 'Montant gelé',
    'Reward Ratio': 'Taux de récompense',
    'New rewards remain frozen for 24 hours before they become available for transfer.':
      'Les nouvelles récompenses sont gelées pendant 24 heures avant de pouvoir être transférées.',
    'Invited User': 'Utilisateur invité',
    'Joined At': 'Inscription',
    'Last Earned At': 'Date du dernier gain',
    'Last Reward': 'Dernière récompense',
    'Manage invited users and referral rewards.':
      'Gérer les utilisateurs invités et les récompenses de parrainage.',
    'No referred users yet': 'Aucun utilisateur invité',
    'Share your referral link': 'Partager votre lien de parrainage',
    'Share your referral link to start earning rewards.':
      'Partagez votre lien pour commencer à gagner des récompenses.',
    'The first three successful top-ups from each invited user earn a rebate.':
      'Les trois premiers rechargements réussis de chaque utilisateur invité donnent droit à une récompense.',
    'Top-ups': 'Rechargements',
    'Reward Earned': 'Récompense gagnée',
    'Affiliate Reward Ratio': 'Taux de récompense d’affiliation',
    'Fraction of each referred user top-up credited to the inviter (0-100%).':
      'Part de chaque recharge de l’utilisateur parrainé créditée au parrain (0-100 %).',
    'Only the first three successful top-ups are eligible.':
      'Seules les trois premières recharges réussies sont éligibles.',
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
    GPT: 'GPT',
    'Chinese Models': 'Modèles chinois',
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
    'Invoice file URL must use HTTPS':
      'L’URL du fichier de facture doit utiliser HTTPS',
    'Invoice notice': 'Avis de facturation',
    'This notice is shown to users above the invoice request form.':
      'Cet avis est affiché aux utilisateurs au-dessus du formulaire de demande de facture.',
    'Enter an optional notice for users':
      'Saisissez un avis facultatif pour les utilisateurs',
    'Invoice notice is too long': 'L’avis de facturation est trop long',
    'Friendly reminder': 'Petit rappel',
    'Export Excel': 'Exporter vers Excel',
    'Export invoice': 'Exporter la facture',
    'Export selected': 'Exporter la sélection',
    'Export order': 'Exporter la commande',
    'Export selected orders': 'Exporter les commandes sélectionnées',
    Export: 'Exporter',
    'Exporting...': 'Exportation...',
    'Failed to export invoices': 'Echec de l’exportation des factures',
    'Invoice ID': 'ID de facture',
    'Issued at': 'Emise le',
    'No invoices to export': 'Aucune facture a exporter',
    'Submitted at': 'Soumise le',
    'Top-up orders': 'Commandes de recharge',
    'Submit and review invoice requests.':
      'Soumettre et consulter les demandes de facture.',
    'Invoice sent to your email':
      'La facture a été envoyée à votre adresse e-mail',
    'The invoice will be sent to this email address.':
      'La facture sera envoyée à cette adresse e-mail.',
    'Invoice title': 'Titre de la facture',
    'Order IDs': 'ID des commandes',
    Notes: 'Notes',
    'Invoice email is required': "L'adresse e-mail de facturation est requise",
    'Invalid invoice email address': 'Adresse e-mail de facturation invalide',
    'Invoice email delivery failed; the invoice remains processing':
      "L'envoi de la facture a échoué ; la facture reste en cours de traitement",
    'Invoice file is too large': 'Le fichier de facture est trop volumineux',
    'Invoice file returned HTTP {{status}}':
      'Le fichier de facture a renvoyé HTTP {{status}}',
    Invoiced: 'Facturé',
    'Not invoiced': 'Non facturé',
    'Mark as invoiced': 'Marquer comme facturé',
    'Mark as not invoiced': 'Marquer comme non facturé',
    'Order marked as invoiced': 'Commande marquée comme facturée',
    'Order marked as not invoiced': 'Commande marquée comme non facturée',
    'Failed to update invoice status':
      'Échec de la mise à jour du statut de facturation',
    'This order will no longer be available for invoice requests.':
      'Cette commande ne sera plus disponible pour les demandes de facture.',
    'This order will become available for invoice requests again.':
      'Cette commande sera de nouveau disponible pour les demandes de facture.',
  },
  ja: {
    Title: 'タイトル',
    'Enter announcement title': 'お知らせのタイトルを入力',
    'Title is required': 'タイトルは必須です',
    'Title must be at most 100 characters':
      'タイトルは100文字以内にしてください',
    'Open in new window': '新しいウィンドウで開く',
    '⭐Purchase Card Codes⭐': '⭐チャージコードを購入⭐',
    'Top-up link is not configured': 'チャージリンクが設定されていません',
    'Administrator adjustment': '管理者による調整',
    'Administrator balance update': '管理者による残高更新',
    'Administrator credit': '管理者による追加',
    'Administrator deduction': '管理者による減額',
    'Balance changes will appear here after a top-up, redemption, or administrator update.':
      'オンラインチャージ、コード交換、または管理者による更新後に残高の変更がここに表示されます。',
    'Balance History': '残高履歴',
    'Failed to load balance history': '残高履歴を読み込めませんでした',
    'No balance changes yet': '残高の変更はまだありません',
    'Online top-up': 'オンラインチャージ',
    'Review every balance change from payments, redemption codes, and administrator updates.':
      '支払い、コード交換、管理者による更新で発生した残高変更を確認できます。',
    'Amount Earned': '獲得金額',
    'Credited Amount': '入金額',
    'Earned At': '獲得日時',
    'Earning Details': '獲得明細',
    'Failed to load details': '明細を読み込めませんでした',
    'Loading details': '明細を読み込み中',
    'No earning details yet': '獲得明細はありません',
    'Order Number': '注文番号',
    'Top-up No.': 'チャージ回数',
    Frozen: '凍結中',
    'Referral rewards cannot be withdrawn and can only be used on this platform.':
      '紹介報酬は出金できず、このプラットフォームでのみ利用できます。',
    'Invited User ID': '招待ユーザー ID',
    'Referral Relations': '紹介関係',
    'Review all inviter and invitee bindings and rewards.':
      'すべての招待者と被招待者の紐付けと報酬を確認します。',
    'Referral bindings and rewards will appear here after users join.':
      'ユーザーが参加すると、紹介関係と報酬がここに表示されます。',
    'Inviter ID': '招待者 ID',
    'Inviter Username': '招待者ユーザー名',
    'Invitee ID': '被招待者 ID',
    'Invitee Username': '被招待者ユーザー名',
    'No referral relations yet': '紹介関係はまだありません',
    'Frozen Reward': '凍結報酬',
    'Frozen Amount': '凍結金額',
    'Reward Ratio': '報酬率',
    'New rewards remain frozen for 24 hours before they become available for transfer.':
      '新しい報酬は24時間凍結され、その後残高へ移行できます。',
    'Invited User': '招待ユーザー',
    'Joined At': '参加日時',
    'Last Earned At': '最終獲得日時',
    'Last Reward': '最新リベート',
    'Manage invited users and referral rewards.':
      '招待ユーザーと紹介報酬を管理します。',
    'No referred users yet': '招待ユーザーはまだいません',
    'Share your referral link': '紹介リンクを共有',
    'Share your referral link to start earning rewards.':
      '紹介リンクを共有して報酬を獲得しましょう。',
    'The first three successful top-ups from each invited user earn a rebate.':
      '招待ユーザーごとに最初の3回の成功したチャージがリベート対象です。',
    'Top-ups': 'チャージ回数',
    'Reward Earned': '獲得報酬',
    'Affiliate Reward Ratio': '紹介報酬率',
    'Fraction of each referred user top-up credited to the inviter (0-100%).':
      '紹介ユーザーの各チャージから招待者に付与する割合（0～100%）。',
    'Only the first three successful top-ups are eligible.':
      '対象となるのは最初の3回のチャージのみです。',
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
    GPT: 'GPT',
    'Chinese Models': '中国系モデル',
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
    'Invoice file URL must use HTTPS':
      '請求書ファイルのURLにはHTTPSを使用してください',
    'Invoice notice': '請求書に関するお知らせ',
    'This notice is shown to users above the invoice request form.':
      'このお知らせは、請求書申請フォームの上に表示されます。',
    'Enter an optional notice for users':
      'ユーザー向けのお知らせを入力（任意）',
    'Invoice notice is too long': '請求書のお知らせが長すぎます',
    'Friendly reminder': 'お知らせ',
    'Export Excel': 'Excel にエクスポート',
    'Export invoice': '請求書をエクスポート',
    'Export selected': '選択項目をエクスポート',
    'Export order': '注文をエクスポート',
    'Export selected orders': '選択した注文をエクスポート',
    Export: 'エクスポート',
    'Exporting...': 'エクスポート中...',
    'Failed to export invoices': '請求書のエクスポートに失敗しました',
    'Invoice ID': '請求書 ID',
    'Issued at': '発行日時',
    'No invoices to export': 'エクスポートする請求書がありません',
    'Submitted at': '申請日時',
    'Top-up orders': '関連するチャージ注文',
    'Submit and review invoice requests.': '請求書申請を送信して確認します。',
    'Invoice sent to your email': '請求書をメールに送信しました',
    'The invoice will be sent to this email address.':
      '請求書はこのメールアドレスに送信されます。',
    'Invoice title': '請求書名義',
    'Order IDs': '注文 ID',
    Notes: '備考',
    'Invoice email is required': '請求書のメールアドレスは必須です',
    'Invalid invoice email address': '請求書のメールアドレスが無効です',
    'Invoice email delivery failed; the invoice remains processing':
      '請求書メールの送信に失敗しました。請求書は処理中のままです',
    'Invoice file is too large': '請求書ファイルが大きすぎます',
    'Invoice file returned HTTP {{status}}':
      '請求書ファイルが HTTP {{status}} を返しました',
    Invoiced: '請求済み',
    'Not invoiced': '未請求',
    'Mark as invoiced': '請求済みにする',
    'Mark as not invoiced': '未請求に戻す',
    'Order marked as invoiced': '注文を請求済みにしました',
    'Order marked as not invoiced': '注文を未請求に戻しました',
    'Failed to update invoice status': '請求ステータスの更新に失敗しました',
    'This order will no longer be available for invoice requests.':
      'この注文は請求申請の対象外になります。',
    'This order will become available for invoice requests again.':
      'この注文は再び請求申請の対象になります。',
  },
  ru: {
    Title: 'Заголовок',
    'Enter announcement title': 'Введите заголовок объявления',
    'Title is required': 'Заголовок обязателен',
    'Title must be at most 100 characters':
      'Заголовок должен быть не длиннее 100 символов',
    'Open in new window': 'Открыть в новом окне',
    '⭐Purchase Card Codes⭐': '⭐Купить коды пополнения⭐',
    'Top-up link is not configured': 'Ссылка для пополнения не настроена',
    'Administrator adjustment': 'Корректировка администратором',
    'Administrator balance update': 'Обновление баланса администратором',
    'Administrator credit': 'Начисление администратором',
    'Administrator deduction': 'Списание администратором',
    'Balance changes will appear here after a top-up, redemption, or administrator update.':
      'Изменения баланса появятся здесь после пополнения, активации кода или обновления администратором.',
    'Balance History': 'История баланса',
    'Failed to load balance history': 'Не удалось загрузить историю баланса',
    'No balance changes yet': 'Изменений баланса пока нет',
    'Online top-up': 'Онлайн-пополнение',
    'Review every balance change from payments, redemption codes, and administrator updates.':
      'Просматривайте все изменения баланса после платежей, активации кодов и действий администратора.',
    'Amount Earned': 'Полученная сумма',
    'Credited Amount': 'Зачисленная сумма',
    'Earned At': 'Время начисления',
    'Earning Details': 'Детали начислений',
    'Failed to load details': 'Не удалось загрузить детали',
    'Loading details': 'Загрузка деталей',
    'No earning details yet': 'Деталей начислений пока нет',
    'Order Number': 'Номер заказа',
    'Top-up No.': 'Номер пополнения',
    Frozen: 'Заморожено',
    'Referral rewards cannot be withdrawn and can only be used on this platform.':
      'Реферальные вознаграждения нельзя вывести; их можно использовать только на этой платформе.',
    'Invited User ID': 'ID приглашённого пользователя',
    'Referral Relations': 'Реферальные связи',
    'Review all inviter and invitee bindings and rewards.':
      'Просматривайте все связи и вознаграждения пригласивших и приглашённых.',
    'Referral bindings and rewards will appear here after users join.':
      'После присоединения пользователей здесь появятся связи и вознаграждения.',
    'Inviter ID': 'ID пригласившего',
    'Inviter Username': 'Имя пользователя пригласившего',
    'Invitee ID': 'ID приглашённого',
    'Invitee Username': 'Имя пользователя приглашённого',
    'No referral relations yet': 'Реферальных связей пока нет',
    'Frozen Reward': 'Замороженная награда',
    'Frozen Amount': 'Замороженная сумма',
    'Reward Ratio': 'Процент награды',
    'New rewards remain frozen for 24 hours before they become available for transfer.':
      'Новые награды заморожены на 24 часа, после чего их можно перевести на баланс.',
    'Invited User': 'Приглашённый пользователь',
    'Joined At': 'Дата регистрации',
    'Last Earned At': 'Время последнего начисления',
    'Last Reward': 'Последняя награда',
    'Manage invited users and referral rewards.':
      'Управление приглашёнными пользователями и реферальными наградами.',
    'No referred users yet': 'Приглашённых пользователей пока нет',
    'Share your referral link': 'Поделитесь реферальной ссылкой',
    'Share your referral link to start earning rewards.':
      'Поделитесь ссылкой, чтобы начать получать награды.',
    'The first three successful top-ups from each invited user earn a rebate.':
      'Первые три успешных пополнения каждого приглашённого пользователя приносят награду.',
    'Top-ups': 'Пополнения',
    'Reward Earned': 'Полученная награда',
    'Affiliate Reward Ratio': 'Процент реферального вознаграждения',
    'Fraction of each referred user top-up credited to the inviter (0-100%).':
      'Доля каждого пополнения приглашённого пользователя, начисляемая пригласившему (0–100%).',
    'Only the first three successful top-ups are eligible.':
      'Учитываются только первые три успешных пополнения.',
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
    GPT: 'GPT',
    'Chinese Models': 'Китайские модели',
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
    'Invoice file URL must use HTTPS':
      'URL файла счёта должен использовать HTTPS',
    'Invoice notice': 'Уведомление о счёте',
    'This notice is shown to users above the invoice request form.':
      'Это уведомление отображается пользователям над формой запроса счёта.',
    'Enter an optional notice for users':
      'Введите необязательное уведомление для пользователей',
    'Invoice notice is too long': 'Уведомление о счёте слишком длинное',
    'Friendly reminder': 'Дружеское напоминание',
    'Export Excel': 'Экспорт в Excel',
    'Export invoice': 'Экспортировать счёт',
    'Export selected': 'Экспортировать выбранные',
    'Export order': 'Экспортировать заказ',
    'Export selected orders': 'Экспортировать выбранные заказы',
    Export: 'Экспорт',
    'Exporting...': 'Экспорт...',
    'Failed to export invoices': 'Не удалось экспортировать счета',
    'Invoice ID': 'ID счета',
    'Issued at': 'Дата выставления',
    'No invoices to export': 'Нет счетов для экспорта',
    'Submitted at': 'Дата подачи',
    'Top-up orders': 'Связанные заказы пополнения',
    'Submit and review invoice requests.':
      'Подавайте заявки на счета и просматривайте их.',
    'Invoice sent to your email': 'Счёт отправлен на вашу электронную почту',
    'The invoice will be sent to this email address.':
      'Счёт будет отправлен на этот адрес электронной почты.',
    'Invoice title': 'Название счёта',
    'Order IDs': 'ID заказов',
    Notes: 'Примечания',
    'Invoice email is required': 'Требуется электронная почта для счёта',
    'Invalid invoice email address':
      'Неверный адрес электронной почты для счёта',
    'Invoice email delivery failed; the invoice remains processing':
      'Не удалось отправить счёт по электронной почте; счёт остаётся в обработке',
    'Invoice file is too large': 'Файл счёта слишком большой',
    'Invoice file returned HTTP {{status}}':
      'Файл счёта вернул HTTP {{status}}',
    Invoiced: 'Выставлен счёт',
    'Not invoiced': 'Счёт не выставлен',
    'Mark as invoiced': 'Отметить как выставленный счёт',
    'Mark as not invoiced': 'Отметить как не выставленный счёт',
    'Order marked as invoiced': 'Заказ отмечен как выставленный счёт',
    'Order marked as not invoiced': 'Заказ отмечен как не выставленный счёт',
    'Failed to update invoice status': 'Не удалось обновить статус счёта',
    'This order will no longer be available for invoice requests.':
      'Заказ больше не будет доступен для запроса счёта.',
    'This order will become available for invoice requests again.':
      'Заказ снова будет доступен для запроса счёта.',
  },
  vi: {
    Title: 'Tiêu đề',
    'Enter announcement title': 'Nhập tiêu đề thông báo',
    'Title is required': 'Tiêu đề là bắt buộc',
    'Title must be at most 100 characters': 'Tiêu đề không được quá 100 ký tự',
    'Open in new window': 'Mở trong cửa sổ mới',
    '⭐Purchase Card Codes⭐': '⭐Mua mã nạp tiền⭐',
    'Top-up link is not configured': 'Chưa cấu hình liên kết nạp tiền',
    'Administrator adjustment': 'Điều chỉnh của quản trị viên',
    'Administrator balance update': 'Quản trị viên cập nhật số dư',
    'Administrator credit': 'Quản trị viên cộng số dư',
    'Administrator deduction': 'Quản trị viên trừ số dư',
    'Balance changes will appear here after a top-up, redemption, or administrator update.':
      'Các thay đổi số dư sẽ xuất hiện tại đây sau khi nạp tiền, đổi mã hoặc được quản trị viên cập nhật.',
    'Balance History': 'Lịch sử số dư',
    'Failed to load balance history': 'Không thể tải lịch sử số dư',
    'No balance changes yet': 'Chưa có thay đổi số dư',
    'Online top-up': 'Nạp tiền trực tuyến',
    'Review every balance change from payments, redemption codes, and administrator updates.':
      'Xem mọi thay đổi số dư từ thanh toán, mã đổi thưởng và cập nhật của quản trị viên.',
    'Amount Earned': 'Số tiền đã nhận',
    'Credited Amount': 'Số tiền đã ghi có',
    'Earned At': 'Thời điểm nhận',
    'Earning Details': 'Chi tiết khoản nhận',
    'Failed to load details': 'Không thể tải chi tiết',
    'Loading details': 'Đang tải chi tiết',
    'No earning details yet': 'Chưa có chi tiết khoản nhận',
    'Order Number': 'Mã đơn hàng',
    'Top-up No.': 'Lần nạp tiền',
    Frozen: 'Đang đóng băng',
    'Referral rewards cannot be withdrawn and can only be used on this platform.':
      'Phần thưởng giới thiệu không thể rút và chỉ được sử dụng trên nền tảng này.',
    'Invited User ID': 'ID người được mời',
    'Referral Relations': 'Quan hệ giới thiệu',
    'Review all inviter and invitee bindings and rewards.':
      'Xem tất cả liên kết và phần thưởng giữa người mời và người được mời.',
    'Referral bindings and rewards will appear here after users join.':
      'Liên kết và phần thưởng sẽ xuất hiện sau khi người dùng tham gia.',
    'Inviter ID': 'ID người mời',
    'Inviter Username': 'Tên người dùng người mời',
    'Invitee ID': 'ID người được mời',
    'Invitee Username': 'Tên người dùng người được mời',
    'No referral relations yet': 'Chưa có quan hệ giới thiệu',
    'Frozen Reward': 'Phần thưởng đang đóng băng',
    'Frozen Amount': 'Số tiền bị đóng băng',
    'Reward Ratio': 'Tỷ lệ phần thưởng',
    'New rewards remain frozen for 24 hours before they become available for transfer.':
      'Phần thưởng mới được đóng băng trong 24 giờ trước khi có thể chuyển vào số dư.',
    'Invited User': 'Người dùng được mời',
    'Joined At': 'Thời gian tham gia',
    'Last Earned At': 'Thời điểm nhận gần nhất',
    'Last Reward': 'Phần thưởng gần nhất',
    'Manage invited users and referral rewards.':
      'Quản lý người dùng được mời và phần thưởng giới thiệu.',
    'No referred users yet': 'Chưa có người dùng được mời',
    'Share your referral link': 'Chia sẻ liên kết giới thiệu',
    'Share your referral link to start earning rewards.':
      'Chia sẻ liên kết để bắt đầu nhận phần thưởng.',
    'The first three successful top-ups from each invited user earn a rebate.':
      'Ba lần nạp tiền thành công đầu tiên của mỗi người được mời sẽ nhận được phần thưởng.',
    'Top-ups': 'Lần nạp tiền',
    'Reward Earned': 'Phần thưởng nhận được',
    'Affiliate Reward Ratio': 'Tỷ lệ thưởng giới thiệu',
    'Fraction of each referred user top-up credited to the inviter (0-100%).':
      'Tỷ lệ từ mỗi lần nạp tiền của người được giới thiệu được cộng cho người mời (0-100%).',
    'Only the first three successful top-ups are eligible.':
      'Chỉ ba lần nạp tiền thành công đầu tiên được áp dụng.',
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
    GPT: 'GPT',
    'Chinese Models': 'Mô hình Trung Quốc',
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
    'Invoice file URL must use HTTPS': 'URL tệp hóa đơn phải sử dụng HTTPS',
    'Invoice notice': 'Thông báo hóa đơn',
    'This notice is shown to users above the invoice request form.':
      'Thông báo này được hiển thị cho người dùng phía trên biểu mẫu yêu cầu hóa đơn.',
    'Enter an optional notice for users':
      'Nhập thông báo tùy chọn cho người dùng',
    'Invoice notice is too long': 'Thông báo hóa đơn quá dài',
    'Friendly reminder': 'Lời nhắc thân thiện',
    'Export Excel': 'Xuất Excel',
    'Export invoice': 'Xuất hóa đơn',
    'Export selected': 'Xuất mục đã chọn',
    'Export order': 'Xuất đơn hàng',
    'Export selected orders': 'Xuất các đơn hàng đã chọn',
    Export: 'Xuất',
    'Exporting...': 'Đang xuất...',
    'Failed to export invoices': 'Không thể xuất hóa đơn',
    'Invoice ID': 'ID hóa đơn',
    'Issued at': 'Thời gian xuất hóa đơn',
    'No invoices to export': 'Không có hóa đơn để xuất',
    'Submitted at': 'Thời gian gửi yêu cầu',
    'Top-up orders': 'Đơn nạp tiền liên quan',
    'Submit and review invoice requests.':
      'Gửi và xem các yêu cầu xuất hóa đơn.',
    'Invoice sent to your email': 'Hóa đơn đã được gửi đến email của bạn',
    'The invoice will be sent to this email address.':
      'Hóa đơn sẽ được gửi đến địa chỉ email này.',
    'Invoice title': 'Tên hóa đơn',
    'Order IDs': 'ID đơn hàng',
    Notes: 'Ghi chú',
    'Invoice email is required': 'Email nhận hóa đơn là bắt buộc',
    'Invalid invoice email address': 'Địa chỉ email hóa đơn không hợp lệ',
    'Invoice email delivery failed; the invoice remains processing':
      'Không thể gửi hóa đơn qua email; hóa đơn vẫn đang được xử lý',
    'Invoice file is too large': 'Tệp hóa đơn quá lớn',
    'Invoice file returned HTTP {{status}}':
      'Tệp hóa đơn trả về HTTP {{status}}',
    Invoiced: 'Đã xuất hóa đơn',
    'Not invoiced': 'Chưa xuất hóa đơn',
    'Mark as invoiced': 'Đánh dấu đã xuất hóa đơn',
    'Mark as not invoiced': 'Đánh dấu chưa xuất hóa đơn',
    'Order marked as invoiced': 'Đã đánh dấu đơn hàng đã xuất hóa đơn',
    'Order marked as not invoiced': 'Đã đánh dấu đơn hàng chưa xuất hóa đơn',
    'Failed to update invoice status': 'Không thể cập nhật trạng thái hóa đơn',
    'This order will no longer be available for invoice requests.':
      'Đơn hàng này sẽ không còn khả dụng để yêu cầu hóa đơn.',
    'This order will become available for invoice requests again.':
      'Đơn hàng này sẽ khả dụng trở lại để yêu cầu hóa đơn.',
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
