chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'readProductData') {
    setTimeout(function() {
      var data = extractProductData(request.sku);
      sendResponse({ success: true, data: data });
    }, 100);
    return true;
  }
});

function extractProductData(targetSku) {
  var bodyText = document.body.innerText || '';
  var EX_RATE = 11.5;

  var skuId = extractSkuId(bodyText, targetSku);
  var weight = extractWeight(bodyText);
  var priceInfo = extractPriceCny(bodyText);
  var priceCny = priceInfo.value || '';
  var priceRub = '';

  if (!skuId || !weight || !priceCny) {
    var detailData = extractFromDetailPage();
    if (detailData) {
      if (!skuId) skuId = detailData.skuId;
      if (!weight) weight = detailData.weight;
      if (!priceCny && detailData.priceCny) {
        priceCny = detailData.priceCny;
        priceInfo = { value: priceCny, isRuble: detailData.isRuble || false };
      }
    }
  }

  if (targetSku) {
    var productData = extractProductBySku(targetSku);
    if (productData) {
      if (productData.weight) weight = productData.weight;
      if (productData.priceCny) {
        priceCny = productData.priceCny;
        priceInfo = { value: priceCny, isRuble: productData.isRuble || false };
      }
    }
  }

  if (priceInfo.isRuble && priceCny) {
    var rubVal = parseFloat(priceCny);
    if (!isNaN(rubVal) && rubVal > 0) {
      priceRub = rubVal.toFixed(2);
      priceCny = (rubVal / EX_RATE).toFixed(2);
    }
  }

  return {
    skuId: skuId || '',
    weight: weight || '',
    priceCny: priceCny || '',
    priceRub: priceRub || ''
  };
}

function extractFromDetailPage() {
  var result = {};
  
  var skuEl = document.querySelector('[data-product-id], [data-sku], [data-nm-id], .product-id');
  if (skuEl) {
    result.skuId = skuEl.getAttribute('data-product-id') || 
                   skuEl.getAttribute('data-sku') || 
                   skuEl.getAttribute('data-nm-id') || 
                   skuEl.textContent;
  }

  var weightEl = document.querySelector('[class*="weight"], [class*="Weight"], .specification-value');
  if (weightEl) {
    var weightText = weightEl.textContent || '';
    var match = weightText.match(/(\d+[\.,]?\d*)\s*[gG克г]/);
    if (match) result.weight = cleanNumber(match[1]);
  }

  var priceEl = document.querySelector('[data-widget="webPrice"], [class*="webPrice"], [class*="price"], [class*="tsHeadline"], [class*="tsBodyControl"]');
  if (priceEl) {
    var priceText = priceEl.textContent || '';
    priceText = priceText.replace(/&thinsp;?/g, '').replace(/&nbsp;?/g, '');

    var pm = priceText.match(/([\d\s,\.]+)\s*[¥￥₽рР]/);
    if (pm) {
      var num = cleanNumber(pm[1]);
      if (num && parseFloat(num) > 0) {
        result.priceCny = num;
        result.isRuble = /[₽рР]/.test(pm[0]);
      }
    }
    if (!result.priceCny) {
      pm = priceText.match(/[¥￥₽рР]\s*([\d\s,\.]+)/);
      if (pm) {
        var num2 = cleanNumber(pm[1]);
        if (num2 && parseFloat(num2) > 0) {
          result.priceCny = num2;
          result.isRuble = /^[₽рР]/.test(pm[0]);
        }
      }
    }
  }

  return Object.keys(result).length > 0 ? result : null;
}

function cleanNumber(str) {
  if (!str) return '';
  str = str.replace(/\s/g, '').replace(/&thinsp;?/g, '').replace(/&nbsp;?/g, '');
  if (/^\d{1,3}(\.\d{3})*(,\d+)?$/.test(str)) {
    str = str.replace(/\./g, '').replace(',', '.');
  } else if (/^\d{1,3}(,\d{3})*(\.\d+)?$/.test(str)) {
    str = str.replace(/,/g, '');
  } else {
    str = str.replace(/,/g, '');
  }
  return str;
}

function extractSkuId(text, targetSku) {
  if (targetSku) {
    var foundSku = findProductBySku(targetSku);
    if (foundSku) return foundSku;
  }

  var patterns = [
    /SKU[：:\s]*ID[：:\s]*([A-Za-z0-9\-_]+)/i,
    /SKU[：:\s]*([A-Za-z0-9\-_]+)/i,
    /sku[_\-]?id[：:\s]*['\"]?([A-Za-z0-9\-_]{4,})['\"]?/i,
    /货号[：:\s]*([A-Za-z0-9\-_]+)/,
    /商品[编代]号[：:\s]*([A-Za-z0-9\-_]+)/,
    /spu[：:\s]*([A-Za-z0-9\-_]+)/i,
    /product[_\-]?id[：:\s]*([A-Za-z0-9\-_]{4,})/i,
    /article[：:\s]*([A-Za-z0-9\-_]+)/i
  ];

  for (var i = 0; i < patterns.length; i++) {
    var match = text.match(patterns[i]);
    if (match) return match[1].trim();
  }

  var skuEl = document.querySelector(
    '[data-sku], [data-spu], [data-product-id], [data-id], ' +
    '[id*="sku"], [id*="spu"], [id*="product-id"], ' +
    '[class*="sku"], [class*="article"]'
  );
  if (skuEl) {
    var val = skuEl.getAttribute('data-sku') || skuEl.getAttribute('data-spu') ||
              skuEl.getAttribute('data-product-id') || skuEl.getAttribute('data-id');
    if (val) return val;
    var txt = (skuEl.textContent || '').trim();
    if (txt && txt.length >= 4) return txt;
  }

  return '';
}

(function() {
  var zoomEl = null;
  var zoomEnabled = true;

  function createZoomEl() {
    var el = document.createElement('div');
    el.id = '__jst_img_zoom';
    el.style.cssText =
      'position:fixed;z-index:2147483647;pointer-events:none;' +
      'display:none;border-radius:6px;box-shadow:0 8px 32px rgba(0,0,0,.35);' +
      'overflow:hidden;background:#fff;padding:4px;max-width:70vw;';
    var img = document.createElement('img');
    img.style.cssText = 'display:block;border-radius:4px;max-height:56.25vh;width:auto;height:auto;';
    el.appendChild(img);
    document.body.appendChild(el);
    return el;
  }

  function position(el, e) {
    var rect = el.getBoundingClientRect();
    var w = rect.width + 8;
    var h = rect.height + 8;
    var left = e.clientX + 16;
    var top = e.clientY + 16;
    if (left + w > window.innerWidth - 10) left = e.clientX - w - 16;
    if (top + h > window.innerHeight - 10) top = e.clientY - h - 16;
    if (left < 10) left = 10;
    if (top < 10) top = 10;
    el.style.left = left + 'px';
    el.style.top = top + 'px';
  }

  function showZoom(img, e) {
    if (!zoomEnabled) return;
    if (!zoomEl) zoomEl = createZoomEl();
    var zoomImg = zoomEl.querySelector('img');
    if (zoomImg.src === img.src && zoomEl.style.display === 'block') return;
    zoomImg.src = img.src;
    zoomEl.style.display = 'block';
    setTimeout(function() { position(zoomEl, e); }, 10);
  }

  function hideZoom() {
    if (zoomEl) zoomEl.style.display = 'none';
  }

  document.addEventListener('mouseover', function(e) {
    if (!zoomEnabled) return;
    var img = e.target;
    if (img.tagName !== 'IMG') img = e.target.closest('img');
    if (!img || img.tagName !== 'IMG') return;
    if (!img.src || img.src.indexOf('data:') === 0) return;
    if (img.naturalWidth < 30 && img.naturalHeight < 30) return;
    showZoom(img, e);
  }, true);

  document.addEventListener('mouseout', function(e) {
    var img = e.target;
    if (img.tagName !== 'IMG') img = e.target.closest('img');
    if (!img || img.tagName !== 'IMG') return;
    var rel = e.relatedTarget;
    if (rel) {
      if (rel.tagName === 'IMG') return;
      if (rel.closest && rel.closest('img')) return;
      if (rel.id === '__jst_img_zoom' || (rel.closest && rel.closest('#__jst_img_zoom'))) return;
    }
    hideZoom();
  }, true);

  chrome.storage.local.get('zoomEnabled', function(data) {
    zoomEnabled = data.zoomEnabled !== false;
  });

  chrome.runtime.onMessage.addListener(function(request) {
    if (request.action === 'setZoom') {
      zoomEnabled = request.enabled !== false;
    }
  });
})();

function findProductBySku(targetSku) {
  var allElements = document.querySelectorAll('*');
  for (var i = 0; i < allElements.length; i++) {
    var el = allElements[i];
    var text = el.textContent || '';
    if (text.indexOf(targetSku) !== -1) {
      return targetSku;
    }
  }
  return null;
}

function extractProductBySku(targetSku) {
  var allElements = document.querySelectorAll('*');
  var productContainer = null;
  
  for (var i = 0; i < allElements.length; i++) {
    var el = allElements[i];
    var text = el.textContent || '';
    if (text.indexOf(targetSku) !== -1) {
      productContainer = findParentContainer(el);
      if (productContainer) break;
    }
  }
  
  if (!productContainer) return null;
  
  var priceResult = extractPriceFromContainer(productContainer);
  var weight = extractWeightFromContainer(productContainer);
  
  return {
    priceCny: priceResult ? priceResult.priceCny : '',
    isRuble: priceResult ? priceResult.isRuble : false,
    weight: weight
  };
}

function findParentContainer(el) {
  var current = el;
  var maxLevels = 10;
  var level = 0;
  
  while (current && level < maxLevels) {
    if (current.tagName === 'ARTICLE' || 
        current.tagName === 'DIV' && (current.classList.contains('tile') || 
                                      current.classList.contains('product') ||
                                      current.classList.contains('item'))) {
      return current;
    }
    current = current.parentElement;
    level++;
  }
  
  return el.parentElement;
}

function extractPriceFromContainer(container) {
  var priceSelectors = [
    '[class*="price"]',
    '[class*="Price"]',
    '[class*="headline"]',
    '[class*="Headline"]',
    '[class*="tsBody"]',
    '[class*="tsHeadline"]',
    '.c35_3_16-a1'
  ];
  
  var isRuble = false;
  
  for (var i = 0; i < priceSelectors.length; i++) {
    var els = container.querySelectorAll(priceSelectors[i]);
    for (var j = 0; j < els.length; j++) {
      var text = els[j].textContent || '';
      text = text.replace(/&thinsp;?/g, '').replace(/&nbsp;?/g, '');

      var mBf = text.match(/([\d\s,\.]+)\s*[¥￥₽рР]/);
      if (mBf) {
        var numBf = cleanNumber(mBf[1]);
        if (numBf && parseFloat(numBf) > 0 && parseFloat(numBf) < 100000) {
          isRuble = /[₽рР]/.test(mBf[0]);
          return { priceCny: numBf, isRuble: isRuble };
        }
      }

      var mAf = text.match(/[¥￥₽рР]\s*([\d\s,\.]+)/);
      if (mAf) {
        var numAf = cleanNumber(mAf[1]);
        if (numAf && parseFloat(numAf) > 0 && parseFloat(numAf) < 100000) {
          isRuble = /^[₽рР]/.test(mAf[0]);
          return { priceCny: numAf, isRuble: isRuble };
        }
      }
    }
  }
  
  return null;
}

function extractWeightFromContainer(container) {
  var text = container.textContent || '';
  var patterns = [
    /(\d+[\.,]?\d*)\s*[gG克]/,
    /(\d+[\.,]?\d*)\s*gram/i,
    /(\d+[\.,]?\d*)\s*г/
  ];
  
  for (var i = 0; i < patterns.length; i++) {
    var match = text.match(patterns[i]);
    if (match) return cleanNumber(match[1]);
  }
  
  return null;
}

function extractWeight(text) {
  var patterns = [
    /克重[：:\s]*(\d+[\.,]?\d*)\s*[gG克]/,
    /重量[：:\s]*(\d+[\.,]?\d*)\s*[gG克]/,
    /净重[：:\s]*(\d+[\.,]?\d*)\s*[gG克]/,
    /毛重[：:\s]*(\d+[\.,]?\d*)\s*[gG克]/,
    /单品重量[：:\s]*(\d+[\.,]?\d*)\s*[gG克]/,
    /重量[：:\s]*大约[：:\s]*(\d+[\.,]?\d*)\s*[gG克]/,
    /(\d+[\.,]?\d*)\s*[gG克]\s*(?:以[内下]|左右)?/,
    /weight[：:\s]*(\d+[\.,]?\d*)\s*[gG]/i,
    /质量[：:\s]*(\d+[\.,]?\d*)\s*[gG克]/,
    /gram[：:\s]*(\d+[\.,]?\d*)/i,
    /weight[：:\s]*(\d+[\.,]?\d*)/i
  ];

  for (var i = 0; i < patterns.length; i++) {
    var match = text.match(patterns[i]);
    if (match) return cleanNumber(match[1]);
  }

  return '';
}

function extractPriceCny(text) {
  var patterns = [
    /售价[：:\s]*[¥￥₽рР]\s*([\d\s,\.]+)/,
    /现价[：:\s]*[¥￥₽рР]\s*([\d\s,\.]+)/,
    /人民币[价]*[：:\s]*[¥￥₽рР]\s*([\d\s,\.]+)/,
    /价格[：:\s]*[¥￥₽рР]\s*([\d\s,\.]+)/,
    /人民币售价[：:\s]*[¥￥₽рР]\s*([\d\s,\.]+)/,
    /CNY[：:\s]*[¥￥₽рР]?\s*([\d\s,\.]+)/i,
    /price[：:\s]*[¥￥₽рР]\s*([\d\s,\.]+)/i,
    /([\d\s,\.]+)\s*[¥￥₽рР]/
  ];

  for (var i = 0; i < patterns.length; i++) {
    var match = text.match(patterns[i]);
    if (match) {
      var num = cleanNumber(match[1]);
      if (num && parseFloat(num) > 0) return { value: num, isRuble: /[₽рР]/.test(match[0]) };
    }
  }

  var priceEls = document.querySelectorAll(
    'span[class*="price"], span[class*="Price"], ' +
    'span[class*="headline"], span[class*="Headline"], ' +
    'div[class*="price"], div[class*="Price"], ' +
    '[data-price], [class*="tsHeadline"], ' +
    '[class*="tsBody"], [class*="c35"], [class*="c107"], ' +
    'div[data-widget="webPrice"], span[data-widget="price"]'
  );
  for (var j = 0; j < priceEls.length; j++) {
    var elText = priceEls[j].textContent || '';
    elText = elText.replace(/&thinsp;?/g, '').replace(/&nbsp;?/g, '');

    var mNumFirst = elText.match(/([\d\s,\.]+)\s*[¥￥₽рР]/);
    if (mNumFirst) {
      var num = cleanNumber(mNumFirst[1]);
      if (num && parseFloat(num) > 0) return { value: num, isRuble: /[₽рР]/.test(mNumFirst[0]) };
    }

    var mSymFirst = elText.match(/[¥￥₽рР]\s*([\d\s,\.]+)/);
    if (mSymFirst) {
      var num2 = cleanNumber(mSymFirst[1]);
      if (num2 && parseFloat(num2) > 0) return { value: num2, isRuble: /^[₽рР]/.test(mSymFirst[0]) };
    }
  }

  var allSpans = document.querySelectorAll('span, div, strong, b');
  for (var k = 0; k < allSpans.length; k++) {
    var t = (allSpans[k].textContent || '').trim();
    t = t.replace(/&thinsp;?/g, '').replace(/&nbsp;?/g, '');
    var mx = t.match(/^[¥￥₽рР]\s*([\d\s,\.]+)$/);
    if (mx) {
      var n = cleanNumber(mx[1]);
      var v = parseFloat(n);
      if (v > 0 && v < 100000) return { value: n, isRuble: /[₽рР]/.test(mx[0]) };
    }
  }

  return { value: '', isRuble: false };
}
