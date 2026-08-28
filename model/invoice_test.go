package model

import (
	"strconv"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setInvoiceIntervalForTest(t *testing.T, days string) {
	t.Helper()
	common.OptionMapRWMutex.Lock()
	if common.OptionMap == nil {
		common.OptionMap = make(map[string]string)
	}
	previous, existed := common.OptionMap["InvoiceRequestIntervalDays"]
	common.OptionMap["InvoiceRequestIntervalDays"] = days
	common.OptionMapRWMutex.Unlock()
	t.Cleanup(func() {
		common.OptionMapRWMutex.Lock()
		defer common.OptionMapRWMutex.Unlock()
		if existed {
			common.OptionMap["InvoiceRequestIntervalDays"] = previous
		} else {
			delete(common.OptionMap, "InvoiceRequestIntervalDays")
		}
	})
}

func TestInvoiceRequestDescriptionTrimsConfiguredValue(t *testing.T) {
	common.OptionMapRWMutex.Lock()
	if common.OptionMap == nil {
		common.OptionMap = make(map[string]string)
	}
	previous, existed := common.OptionMap["InvoiceRequestDescription"]
	common.OptionMap["InvoiceRequestDescription"] = "  Review times may vary.\n  "
	common.OptionMapRWMutex.Unlock()
	t.Cleanup(func() {
		common.OptionMapRWMutex.Lock()
		defer common.OptionMapRWMutex.Unlock()
		if existed {
			common.OptionMap["InvoiceRequestDescription"] = previous
		} else {
			delete(common.OptionMap, "InvoiceRequestDescription")
		}
	})

	require.Equal(t, "Review times may vary.", InvoiceRequestDescription())
}

func insertInvoiceUserAndTopUp(t *testing.T, userId int, tradeNo string) TopUp {
	t.Helper()
	user := User{Id: userId, Username: tradeNo, Status: common.UserStatusEnabled}
	require.NoError(t, DB.Create(&user).Error)
	topUp := TopUp{UserId: userId, TradeNo: tradeNo, Status: common.TopUpStatusSuccess, Money: 19.99, Amount: 1000, CreateTime: time.Now().Unix()}
	require.NoError(t, DB.Create(&topUp).Error)
	return topUp
}

func TestCreateInvoiceProtectsOrderEligibilityAndFrequency(t *testing.T) {
	truncateTables(t)
	setInvoiceIntervalForTest(t, "30")
	topUp := insertInvoiceUserAndTopUp(t, 801, "invoice-order-1")

	first := &Invoice{InvoiceType: "normal", BuyerType: "company", Title: "Acme", TaxNumber: "123", Email: "billing@example.com"}
	require.NoError(t, CreateInvoice(801, []int{topUp.Id}, first))
	assert.Equal(t, 19.99, first.Amount)

	second := &Invoice{InvoiceType: "normal", BuyerType: "company", Title: "Acme", TaxNumber: "123", Email: "billing@example.com"}
	require.ErrorIs(t, CreateInvoice(801, []int{topUp.Id}, second), ErrInvoiceFrequencyLimited)

	eligible, err := GetEligibleInvoiceOrders(801)
	require.NoError(t, err)
	assert.Empty(t, eligible)
}

func TestRejectedInvoiceReleasesOrderAndFrequency(t *testing.T) {
	truncateTables(t)
	setInvoiceIntervalForTest(t, "15")
	topUp := insertInvoiceUserAndTopUp(t, 802, "invoice-order-2")
	invoice := &Invoice{InvoiceType: "normal", BuyerType: "individual", Title: "Example", Email: "billing@example.com"}
	require.NoError(t, CreateInvoice(802, []int{topUp.Id}, invoice))
	require.NoError(t, UpdateInvoiceStatus(invoice.Id, InvoiceStatusRejected, "incorrect title", "", ""))

	canSubmit, nextAvailableAt, err := GetInvoiceRequestAvailability(802)
	require.NoError(t, err)
	assert.True(t, canSubmit)
	assert.Zero(t, nextAvailableAt)

	eligible, err := GetEligibleInvoiceOrders(802)
	require.NoError(t, err)
	require.Len(t, eligible, 1)
	assert.Equal(t, topUp.Id, eligible[0].TopUpId)
}

func TestEligibleInvoiceOrdersJSONUsesTopupID(t *testing.T) {
	truncateTables(t)
	topUp := insertInvoiceUserAndTopUp(t, 804, "invoice-order-json")

	eligible, err := GetEligibleInvoiceOrders(804)
	require.NoError(t, err)
	require.Len(t, eligible, 1)

	payload, err := common.Marshal(eligible)
	require.NoError(t, err)
	assert.Contains(t, string(payload), `"topup_id":`)
	assert.NotContains(t, string(payload), `"top_up_id":`)
	assert.Equal(t, topUp.Id, eligible[0].TopUpId)
}

func TestInvoiceIssuedTopUpIsExcludedAndCanBeRestored(t *testing.T) {
	truncateTables(t)
	topUp := insertInvoiceUserAndTopUp(t, 806, "invoice-order-manual")

	require.NoError(t, UpdateTopUpInvoiceStatus(topUp.Id, true))
	eligible, err := GetEligibleInvoiceOrders(806)
	require.NoError(t, err)
	assert.Empty(t, eligible)

	require.NoError(t, UpdateTopUpInvoiceStatus(topUp.Id, false))
	eligible, err = GetEligibleInvoiceOrders(806)
	require.NoError(t, err)
	require.Len(t, eligible, 1)
	assert.Equal(t, topUp.Id, eligible[0].TopUpId)
}

func TestLegacyTopUpWithNullInvoiceStatusRemainsEligible(t *testing.T) {
	truncateTables(t)
	topUp := insertInvoiceUserAndTopUp(t, 808, "invoice-order-legacy")
	require.NoError(t, DB.Model(&TopUp{}).Where("id = ?", topUp.Id).Update("invoice_issued", nil).Error)

	eligible, err := GetEligibleInvoiceOrders(808)
	require.NoError(t, err)
	require.Len(t, eligible, 1)
	assert.Equal(t, topUp.Id, eligible[0].TopUpId)
}

func TestInvoiceStatusCannotChangeForUnsuccessfulTopUp(t *testing.T) {
	truncateTables(t)
	user := User{Id: 807, Username: "invoice-order-pending-user", Status: common.UserStatusEnabled}
	require.NoError(t, DB.Create(&user).Error)
	topUp := TopUp{UserId: user.Id, TradeNo: "invoice-order-pending", Status: common.TopUpStatusPending, Money: 10, Amount: 100}
	require.NoError(t, DB.Create(&topUp).Error)

	require.ErrorIs(t, UpdateTopUpInvoiceStatus(topUp.Id, true), ErrTopUpInvoiceStatusInvalid)
}

func TestGetEligibleInvoiceOrdersPagedAppliesLimitOffsetAndTotal(t *testing.T) {
	truncateTables(t)
	user := User{Id: 805, Username: "invoice-order-page-user", Status: common.UserStatusEnabled}
	require.NoError(t, DB.Create(&user).Error)
	for i := 0; i < 3; i++ {
		topUp := TopUp{UserId: 805, TradeNo: "invoice-order-page-" + strconv.Itoa(i), Status: common.TopUpStatusSuccess, Money: 19.99, Amount: 1000, CreateTime: time.Now().Unix()}
		require.NoError(t, DB.Create(&topUp).Error)
	}

	pageInfo := &common.PageInfo{Page: 2, PageSize: 2}
	items, total, err := GetEligibleInvoiceOrdersPaged(805, pageInfo)
	require.NoError(t, err)
	assert.Equal(t, int64(3), total)
	require.Len(t, items, 1)
}

func TestInvoiceStatusTransitionsRejectInvalidUpdates(t *testing.T) {
	truncateTables(t)
	setInvoiceIntervalForTest(t, "0")
	topUp := insertInvoiceUserAndTopUp(t, 803, "invoice-order-3")
	invoice := &Invoice{InvoiceType: "normal", BuyerType: "individual", Title: "Example", Email: "billing@example.com"}
	require.NoError(t, CreateInvoice(803, []int{topUp.Id}, invoice))

	require.ErrorIs(t, UpdateInvoiceStatus(invoice.Id, InvoiceStatusIssued, "", "INV-1", "https://example.com/invoice.pdf"), ErrInvoiceStatusInvalid)
	require.NoError(t, UpdateInvoiceStatus(invoice.Id, InvoiceStatusProcessing, "", "", ""))
	require.NoError(t, UpdateInvoiceStatus(invoice.Id, InvoiceStatusIssued, "", "INV-1", "https://example.com/invoice.pdf"))
	var updatedTopUp TopUp
	require.NoError(t, DB.First(&updatedTopUp, topUp.Id).Error)
	assert.True(t, updatedTopUp.InvoiceIssued)
	require.ErrorIs(t, UpdateInvoiceStatus(invoice.Id, InvoiceStatusRejected, "late rejection", "", ""), ErrInvoiceStatusInvalid)
}

func TestBillingHistoryReflectsPreviouslyIssuedInvoice(t *testing.T) {
	truncateTables(t)
	setInvoiceIntervalForTest(t, "0")
	topUp := insertInvoiceUserAndTopUp(t, 809, "invoice-order-history")
	invoice := &Invoice{InvoiceType: "normal", BuyerType: "individual", Title: "Example", Email: "billing@example.com"}
	require.NoError(t, CreateInvoice(809, []int{topUp.Id}, invoice))
	require.NoError(t, DB.Model(&Invoice{}).Where("id = ?", invoice.Id).Updates(map[string]interface{}{"status": InvoiceStatusIssued}).Error)

	pageInfo := &common.PageInfo{Page: 1, PageSize: 10}
	history, _, err := GetUserTopUps(809, pageInfo)
	require.NoError(t, err)
	require.Len(t, history, 1)
	assert.True(t, history[0].InvoiceIssued)
}

func TestInvoiceMigrationIsRepeatable(t *testing.T) {
	require.NoError(t, DB.AutoMigrate(&Invoice{}, &InvoiceOrder{}))
	require.NoError(t, DB.AutoMigrate(&Invoice{}, &InvoiceOrder{}))
}
