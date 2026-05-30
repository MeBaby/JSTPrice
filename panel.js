var EXCHANGE_RATE = 11.5;
var DEFAULT_COMMISSION = 13;
var DEFAULT_AGENT_FEE = 7;
var DEFAULT_RETURN = 7;
var DEFAULT_PACK_FEE = 1.50;
var DEFAULT_DELIVERY_FEE = 1.32;

var isSyncing = false;
var productWeight = null;

var REQUIRED_IDS = ['priceCny', 'priceRub', 'purchasePrice', 'intlShipping', 'commissionRate', 'agentFeeRate', 'returnRate', 'packFee', 'deliveryFee'];

function $(id) { return document.getElementById(id); }

function getVal(id) {
  var v = parseFloat($(id).value);
  return isNaN(v) ? 0 : v;
}

function calcIntlShipping(g) {
  if (!g || g <= 0) return 0;
  if (g <= 500) return 2 + 1 + g * 26 / 1000;
  if (g <= 2000) return 16 + g * 25 / 1000;
  return 36 + g * 17 / 1000;
}

function getShippingFormula(g) {
  if (!g || g <= 0) return '';
  if (g <= 500) return '2+1+' + g + '\u00d726\u00f71000 = ' + calcIntlShipping(g).toFixed(2);
  if (g <= 2000) return '16+' + g + '\u00d725\u00f71000 = ' + calcIntlShipping(g).toFixed(2);
  return '36+' + g + '\u00d717\u00f71000 = ' + calcIntlShipping(g).toFixed(2);
}

function updateShippingTooltip() {
  var g = productWeight;
  if (g) {
    $('tipShipping').textContent = getShippingFormula(g);
  } else {
    $('tipShipping').textContent = '\u8bf7\u5148\u8bfb\u53d6\u5546\u54c1\u514b\u91cd';
  }
}

function clearAllErrors() {
  REQUIRED_IDS.forEach(function(id) { $(id).classList.remove('error'); });
}

function markEmptyFields() {
  var emptyFields = [];
  REQUIRED_IDS.forEach(function(id) {
    var el = $(id);
    if (el.value === '' || el.value === null) {
      el.classList.add('error');
      emptyFields.push(id);
    }
  });
  return emptyFields;
}

function allFieldsFilled() {
  return REQUIRED_IDS.every(function(id) {
    var v = $(id).value;
    return v !== '' && v !== null;
  });
}

function syncFromCny() {
  if (isSyncing) return;
  isSyncing = true;
  var cny = getVal('priceCny');
  if (cny > 0) {
    $('priceRub').value = (cny * EXCHANGE_RATE).toFixed(2);
  } else {
    $('priceRub').value = '';
  }
  isSyncing = false;
  tryAutoCalc();
}

function syncFromRub() {
  if (isSyncing) return;
  isSyncing = true;
  var rub = getVal('priceRub');
  if (rub > 0) {
    $('priceCny').value = (rub / EXCHANGE_RATE).toFixed(2);
  } else {
    $('priceCny').value = '';
  }
  isSyncing = false;
  tryAutoCalc();
}

function calcProfit() {
  if (!allFieldsFilled()) return;

  var nowPrice = getVal('priceCny');
  var purchasePrice = getVal('purchasePrice');
  var commissionRate = getVal('commissionRate');
  var agentFeeRate = getVal('agentFeeRate');
  var returnRate = getVal('returnRate');
  var packFee = getVal('packFee');
  var deliveryFee = getVal('deliveryFee');
  var intlShipping = getVal('intlShipping');

  if (nowPrice <= 0) { return; }

  var totalRate = (commissionRate + agentFeeRate + returnRate) / 100;
  var netProfit = nowPrice * (1 - totalRate) - packFee - purchasePrice - deliveryFee - intlShipping;
  var netProfitRate = (netProfit / nowPrice) * 100;

  $('netProfit').textContent = '\u00a5 ' + netProfit.toFixed(2);
  $('netProfitRate').textContent = netProfitRate.toFixed(2) + '%';

  if (netProfit >= 0) {
    $('netProfit').className = 'result-val color-good';
    $('netProfitRate').className = 'result-rate color-good';
  } else {
    $('netProfit').className = 'result-val color-bad';
    $('netProfitRate').className = 'result-rate color-bad';
  }

  $('tipProfit').textContent =
    nowPrice.toFixed(2) + '\u00d7(1-' + commissionRate + '%-' + agentFeeRate + '%-' + returnRate + '%)-' +
    packFee.toFixed(2) + '-' + purchasePrice.toFixed(2) + '-' +
    deliveryFee.toFixed(2) + '-' + intlShipping.toFixed(2) +
    ' = ' + netProfit.toFixed(2);

  $('tipRate').textContent = netProfit.toFixed(2) + '\u00f7' + nowPrice.toFixed(2) + ' = ' + netProfitRate.toFixed(2) + '%';
}

function tryAutoCalc() {
  if (allFieldsFilled()) {
    clearAllErrors();
    calcProfit();
  }
}

function fillProductInfo(data) {
  if (data.skuId) $('skuId').textContent = data.skuId;

  if (data.weight) {
    $('weight').textContent = data.weight;
    productWeight = parseFloat(data.weight);
    if (!isNaN(productWeight) && productWeight > 0) {
      var shipping = calcIntlShipping(productWeight);
      $('intlShipping').value = shipping.toFixed(2);
      updateShippingTooltip();
    }
  }

  if (data.priceCny && parseFloat(data.priceCny) > 0) {
    $('priceCny').value = parseFloat(data.priceCny);
    syncFromCny();
  }
}

function saveSettings() {
  var obj = {};
  REQUIRED_IDS.forEach(function(id) { obj[id] = $(id).value; });
  chrome.storage.local.set(obj);
}

function loadSettings() {
  chrome.storage.local.get({
    priceCny: '', priceRub: '', purchasePrice: '', intlShipping: '',
    commissionRate: DEFAULT_COMMISSION, agentFeeRate: DEFAULT_AGENT_FEE, returnRate: DEFAULT_RETURN,
    packFee: DEFAULT_PACK_FEE, deliveryFee: DEFAULT_DELIVERY_FEE
  }, function(items) {
    $('commissionRate').value = items.commissionRate;
    $('agentFeeRate').value = items.agentFeeRate;
    $('returnRate').value = items.returnRate;
    $('packFee').value = items.packFee;
    $('deliveryFee').value = items.deliveryFee;
    if (items.intlShipping) $('intlShipping').value = items.intlShipping;
    if (items.purchasePrice) $('purchasePrice').value = items.purchasePrice;
    if (items.priceCny) $('priceCny').value = items.priceCny;
    if (items.priceRub) $('priceRub').value = items.priceRub;
  });
}

function readPageData(showMsg) {
  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    if (!tabs[0]) { showStatus('\u65e0\u6cd5\u83b7\u53d6\u5f53\u524d\u9875\u9762', true); return; }
    chrome.tabs.sendMessage(tabs[0].id, { action: 'readProductData' }, function(response) {
      if (chrome.runtime.lastError) { showStatus('\u8bf7\u5237\u65b0\u9875\u9762\u540e\u91cd\u8bd5', true); return; }
      if (response && response.success) {
        fillProductInfo(response.data);
        if (showMsg) showStatus('\u5df2\u91cd\u65b0\u8bfb\u53d6\u5546\u54c1\u6570\u636e');
      } else if (showMsg) {
        showStatus('\u672a\u8bc6\u522b\u5230\u5546\u54c1\u6570\u636e\uff0c\u8bf7\u624b\u52a8\u586b\u5199', true);
      }
    });
  });
}

function showStatus(msg, isErr) {
  $('status').textContent = msg;
  $('status').className = isErr ? 'status error' : 'status';
  setTimeout(function() { $('status').textContent = ''; $('status').className = 'status'; }, 2500);
}

document.addEventListener('DOMContentLoaded', function() {
  loadSettings();
  readPageData(false);

  $('btnRead').addEventListener('click', function() {
    readPageData(true);
  });

  $('calcBtn').addEventListener('click', function() {
    clearAllErrors();
    if (!allFieldsFilled()) {
      var empty = markEmptyFields();
      var count = empty.length;
      showStatus('\u8bf7\u586b\u5199\u5168\u90e8 ' + count + ' \u4e2a\u7a7a\u767d\u9879\u540e\u518d\u8ba1\u7b97\uff0c\u5df2\u7528\u7ea2\u6846\u6807\u51fa', true);
      return;
    }
    saveSettings();
    calcProfit();
    showStatus('\u8ba1\u7b97\u5b8c\u6210');
  });

  $('priceCny').addEventListener('input', function() {
    $(this).classList.remove('error');
    syncFromCny();
    saveSettings();
    tryAutoCalc();
  });

  $('priceRub').addEventListener('input', function() {
    $(this).classList.remove('error');
    syncFromRub();
    saveSettings();
    tryAutoCalc();
  });

  var costIds = ['purchasePrice', 'commissionRate', 'agentFeeRate', 'returnRate', 'packFee', 'deliveryFee', 'intlShipping'];
  costIds.forEach(function(id) {
    $(id).addEventListener('input', function() {
      $(this).classList.remove('error');
      saveSettings();
      updateShippingTooltip();
      tryAutoCalc();
    });
  });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'tabUpdated') {
    readPageData(false);
  }
});