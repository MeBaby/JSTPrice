var EXCHANGE_RATE = 11.5;
var DEFAULT_COMMISSION = 13;
var DEFAULT_AGENT_FEE = 7;
var DEFAULT_RETURN = 7;
var DEFAULT_PACK_FEE = 1.50;
var DEFAULT_DELIVERY_FEE = 1.32;

var isSyncing = false;
var productWeight = null;
var deviceId = null;

var REQUIRED_IDS = ['priceCny', 'priceRub', 'purchasePrice', 'intlShipping', 'commissionRate', 'agentFeeRate', 'returnRate', 'packFee', 'deliveryFee'];

const API_BASE = 'http://localhost:3001/api/activation';

function $(id) { return document.getElementById(id); }

function getVal(id) {
  var v = parseFloat($(id).value);
  return isNaN(v) ? 0 : v;
}

function getDeviceId() {
  if (deviceId) return deviceId;
  deviceId = localStorage.getItem('device_id');
  if (!deviceId) {
    deviceId = 'device_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('device_id', deviceId);
  }
  return deviceId;
}

async function checkActivation() {
  const savedCode = localStorage.getItem('activation_code');
  if (!savedCode) return false;

  const freeTrialUsed = localStorage.getItem('free_trial_used');
  if (freeTrialUsed) {
    const expireDate = new Date(localStorage.getItem('activation_expire'));
    if (expireDate > new Date()) {
      showExpireInfo(localStorage.getItem('activation_expire'));
      return true;
    }
  }

  try {
    const response = await fetch(`${API_BASE}/check?code=${encodeURIComponent(savedCode)}&deviceId=${encodeURIComponent(getDeviceId())}`);
    const data = await response.json();
    
    if (data.success && data.activated) {
      showExpireInfo(data.expireDate);
      return true;
    }
    return false;
  } catch (e) {
    console.error('Check activation error:', e);
    return false;
  }
}

async function activate(code) {
  try {
    const response = await fetch(`${API_BASE}/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: code.toUpperCase(), deviceId: getDeviceId() })
    });
    const data = await response.json();
    
    if (data.success) {
      localStorage.setItem('activation_code', code.toUpperCase());
      localStorage.setItem('activation_expire', data.expireDate);
      showExpireInfo(data.expireDate);
      return { success: true, message: data.message };
    } else {
      return { success: false, message: data.message };
    }
  } catch (e) {
    console.error('Activate error:', e);
    return { success: false, message: '网络错误，请稍后重试' };
  }
}

function activateFreeTrial() {
  const freeTrialUsed = localStorage.getItem('free_trial_used');
  if (freeTrialUsed) {
    $('freeTrialStatus').textContent = '当前设备已领取过免费试用';
    return;
  }

  var expireDate = new Date();
  expireDate.setDate(expireDate.getDate() + 3);
  var expireDateStr = expireDate.toISOString().split('T')[0];

  localStorage.setItem('activation_code', 'FREE_TRIAL_' + getDeviceId());
  localStorage.setItem('activation_expire', expireDateStr);
  localStorage.setItem('free_trial_used', '1');

  $('freeTrialStatus').textContent = '免费试用3天已激活！';
  $('freeTrialStatus').style.color = '#28a745';
  $('btnFreeTrial').classList.add('used');
  $('btnFreeTrial').textContent = '已领取';

  showExpireInfo(expireDateStr);

  setTimeout(() => {
    $('activationWrap').style.display = 'none';
    $('mainWrap').style.display = 'block';
    initMain();
  }, 1000);
}

function checkFreeTrialStatus() {
  const freeTrialUsed = localStorage.getItem('free_trial_used');
  if (freeTrialUsed) {
    var expireDate = new Date(localStorage.getItem('activation_expire'));
    if (expireDate > new Date()) {
      $('btnFreeTrial').classList.add('used');
      $('btnFreeTrial').textContent = '已领取';
      $('freeTrialStatus').textContent = '免费试用3天（已激活）';
    } else {
      $('btnFreeTrial').classList.add('used');
      $('btnFreeTrial').textContent = '已过期';
      $('btnFreeTrial').style.cursor = 'not-allowed';
      $('freeTrialStatus').textContent = '免费试用已过期，请购买正式激活码';
    }
  }
}

function showExpireInfo(expireDate) {
  $('expireInfo').textContent = '有效期至: ' + expireDate;
}

function showActivateStatus(message, isError) {
  $('activateStatus').textContent = message;
  $('activateStatus').style.color = isError ? '#f87171' : '#28a745';
}

async function initActivation() {
  const isActivated = await checkActivation();
  if (isActivated) {
    $('activationWrap').style.display = 'none';
    $('mainWrap').style.display = 'block';
    initMain();
  } else {
    checkFreeTrialStatus();
  }
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
    $('resultWrap').style.display = 'block';
  }
}

function fillProductInfo(data) {
  if (data.skuId) $('skuId').value = data.skuId;

  if (data.weight) {
    $('weight').value = data.weight;
    productWeight = parseFloat(data.weight);
    if (!isNaN(productWeight) && productWeight > 0) {
      var shipping = calcIntlShipping(productWeight);
      $('intlShipping').value = shipping.toFixed(2);
      updateShippingTooltip();
    }
  } else {
    $('weight').value = '';
    productWeight = null;
    $('intlShipping').value = '';
    updateShippingTooltip();
  }

  if (data.priceCny && parseFloat(data.priceCny) > 0) {
    $('priceCny').value = parseFloat(data.priceCny);
    syncFromCny();
  } else {
    $('priceCny').value = '';
    $('priceRub').value = '';
  }

  $('purchasePrice').value = '';
}

function saveSettings() {
  var obj = {};
  REQUIRED_IDS.forEach(function(id) { obj[id] = $(id).value; });
  chrome.storage.local.set(obj);
}

function loadSettings() {
  chrome.storage.local.get({
    commissionRate: DEFAULT_COMMISSION, agentFeeRate: DEFAULT_AGENT_FEE, returnRate: DEFAULT_RETURN,
    packFee: DEFAULT_PACK_FEE, deliveryFee: DEFAULT_DELIVERY_FEE
  }, function(items) {
    $('commissionRate').value = items.commissionRate;
    $('agentFeeRate').value = items.agentFeeRate;
    $('returnRate').value = items.returnRate;
    $('packFee').value = items.packFee;
    $('deliveryFee').value = items.deliveryFee;
  });
}

function readPageData(showMsg) {
  var targetSku = $('skuId').value.trim();
  
  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    if (!tabs[0]) { showStatus('\u65e0\u6cd5\u83b7\u53d6\u5f53\u524d\u9875\u9762', true); return; }
    chrome.tabs.sendMessage(tabs[0].id, { action: 'readProductData', sku: targetSku }, function(response) {
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

function broadcastZoom(enabled) {
  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, { action: 'setZoom', enabled: enabled });
    }
  });
}

function showStatus(msg, isErr) {
  $('status').textContent = msg;
  $('status').className = isErr ? 'status error' : 'status';
  setTimeout(function() { $('status').textContent = ''; $('status').className = 'status'; }, 2500);
}

function initMain() {
  loadSettings();
  readPageData(false);

  chrome.storage.local.get('zoomEnabled', function(data) {
    var enabled = data.zoomEnabled !== false;
    $('zoomToggle').checked = enabled;
    broadcastZoom(enabled);
  });

  $('zoomToggle').addEventListener('change', function() {
    var enabled = this.checked;
    chrome.storage.local.set({ zoomEnabled: enabled });
    broadcastZoom(enabled);
  });

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
    $('resultWrap').style.display = 'block';
    showStatus('\u8ba1\u7b97\u5b8c\u6210');
  });

  $('priceCny').addEventListener('input', function() {
    this.classList.remove('error');
    syncFromCny();
    saveSettings();
    tryAutoCalc();
  });

  $('priceRub').addEventListener('input', function() {
    this.classList.remove('error');
    syncFromRub();
    saveSettings();
    tryAutoCalc();
  });

  $('weight').addEventListener('input', function() {
    var weight = parseFloat(this.value);
    productWeight = isNaN(weight) ? null : weight;
    
    if (productWeight && productWeight > 0) {
      var shipping = calcIntlShipping(productWeight);
      $('intlShipping').value = shipping.toFixed(2);
    } else {
      $('intlShipping').value = '';
    }
    
    updateShippingTooltip();
    tryAutoCalc();
  });

  var costIds = ['purchasePrice', 'commissionRate', 'agentFeeRate', 'returnRate', 'packFee', 'deliveryFee', 'intlShipping'];
  costIds.forEach(function(id) {
    $(id).addEventListener('input', function() {
      this.classList.remove('error');
      saveSettings();
      updateShippingTooltip();
      tryAutoCalc();
    });
  });
}

document.addEventListener('DOMContentLoaded', function() {
  initActivation();

  $('btnActivate').addEventListener('click', async function() {
    const code = $('activationCode').value.trim();
    if (!code) {
      showActivateStatus('请输入激活码', true);
      return;
    }
    
    showActivateStatus('激活中...', false);
    
    const result = await activate(code);
    if (result.success) {
      showActivateStatus(result.message, false);
      setTimeout(() => {
        $('activationWrap').style.display = 'none';
        $('mainWrap').style.display = 'block';
        initMain();
      }, 1000);
    } else {
      showActivateStatus(result.message, true);
    }
  });

  $('btnFreeTrial').addEventListener('click', function() {
    activateFreeTrial();
  });

  $('activationCode').addEventListener('keyup', function(e) {
    if (e.key === 'Enter') {
      $('btnActivate').click();
    }
  });

  initActivation();
});