// ========== 全局配置（已修正Bmob表名：Biorecord） ==========
const CONFIG = {
  // 七牛云配置（修复token生成逻辑）
  qiniu: {
    accessKey: 'yKxE6WR1F9dkG0CGbiyz0lresDrT5qP8aOPn6AmE',
    secretKey: '7IpPeccpByDgfMGjJ_SW2jqigIJTTP5v_sEETstq',
    bucket: 'wcy-oversea',
    domain: 'http://img.yixiangyiyingbiomap.icu',
    region: qiniu.region.as0 // 确认存储空间区域：z0=华东 z1=华北 z2=华南 na0=北美
  },
  // 高德地图配置（双Key分离）
  amap: {
    webKey: '0aa9b501ff5aebd37cdefcee74d23130',   // Web端JS API Key
    serviceKey: 'cf3803bdab92f8353864f4dc6f38957e' // Web服务API Key（地址解析）
  },
  // Bmob配置（核心修正：表名改为 Biorecord）
  bmob: {
    appId: '4c5834e6db284bb312e384edbc310a16',
    restKey: 'b6749afe8f47ff6d2cdb27a8dca49958',
    baseUrl: 'https://api.bmobcloud.com/1/classes',
    tableName: 'Biorecord' // 关键修正：和你创建的表名完全一致！
  },
  // 地图初始配置
  mapInit: { lng: 103.8198, lat: 36.0611, zoom: 4 }
};

// ========== 全局变量 ==========
let map = null;        // 高德地图实例
let bioData = {};      // 本地缓存生物数据
let infoWindow = null; // 地图弹窗实例

// ========== 页面加载初始化 ==========
window.onload = function() {
  setTimeout(() => {
    initMap();         // 初始化地图
    loadAllBioData();  // 从Bmob加载历史数据
  }, 1000);
};

// ========== 1. 初始化高德地图 ==========
function initMap() {
  if (typeof AMap === 'undefined') {
    alert('高德地图API加载失败，请检查网络或Key是否正确');
    return;
  }

  try {
    // 创建地图实例
    map = new AMap.Map('mapContainer', {
      zoom: CONFIG.mapInit.zoom,
      center: [CONFIG.mapInit.lng, CONFIG.mapInit.lat],
      resizeEnable: true
    });

    // 添加地图工具栏
    map.addControl(new AMap.ToolBar({ position: 'RB' }));
    // 创建信息弹窗
    infoWindow = new AMap.InfoWindow({ offset: new AMap.Pixel(0, -30) });
    
    console.log('✅ 地图初始化成功');
  } catch (err) {
    console.error('地图初始化失败:', err);
    alert('地图加载失败：' + err.message);
  }
}

// ========== 2. 从Bmob加载所有生物数据（表名已修正） ==========
async function loadAllBioData() {
  try {
    console.log('🔍 开始从Bmob加载数据，表名：', CONFIG.bmob.tableName);
    const response = await fetch(`${CONFIG.bmob.baseUrl}/${CONFIG.bmob.tableName}`, {
      method: 'GET',
      headers: {
        'X-Bmob-Application-Id': CONFIG.bmob.appId,
        'X-Bmob-REST-API-Key': CONFIG.bmob.restKey,
        'Content-Type': 'application/json'
      }
    });

    console.log('🔍 Bmob响应状态：', response.status);
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Bmob请求失败：${response.status} - ${JSON.stringify(errorData)}`);
    }
    
    const { results } = await response.json();
    console.log('✅ 从Bmob加载到数据：', results);

    // 格式化数据：按经纬度分组
    bioData = {};
    results.forEach(item => {
      const lngLatKey = `${item.lng}_${item.lat}`;
      if (!bioData[lngLatKey]) bioData[lngLatKey] = [];
      bioData[lngLatKey].push({
        bioType: item.bioType,
        bioName: item.bioName,
        address: item.address,
        bioDesc: item.bioDesc,
        imgUrl: item.imgUrl,
        uploadTime: item.uploadTime,
        lng: item.lng,
        lat: item.lat
      });
    });

    // 渲染所有点位标记
    renderAllBioMarkers();
    console.log(`✅ 加载完成，共 ${Object.keys(bioData).length} 个点位`);
  } catch (err) {
    console.error('加载数据失败:', err);
    alert(`加载历史数据失败：${err.message}\n（不影响上传，可先测试上传功能）`);
  }
}

// ========== 3. 渲染所有生物点位标记 ==========
function renderAllBioMarkers() {
  Object.keys(bioData).forEach((lngLatKey) => {
    const [lng, lat] = lngLatKey.split('_');
    createBioMarker(parseFloat(lng), parseFloat(lat));
  });
}

// ========== 4. 创建单个生物点位标记 ==========
f// ============= 4. 创建单个生物点位标记 ==============
function createBioMarker(lng, lat) {
  // 用纯CSS圆点代替图片图标
  const marker = new AMap.Marker({
    position: [lng, lat],
    // 核心修改：用 content 代替 icon，直接画一个绿色圆点
    content: '<div style="width:12px;height:12px;border-radius:50%;background:#4CAF50;border:2px solid white;box-shadow:0 0 4px rgba(0,0,0,0.3);"></div>',
    anchor: 'center', // 锚点在中心，和圆点中心对齐
    zIndex: 100
  });

  // 标记点击事件：显示该位置生物列表（完全保留你原来的逻辑）
  marker.on('click', () => {
    const lngLatKey = `${lng}_${lat}`;
    const bioList = bioData[lngLatKey] || [];

    // 构建弹窗内容
    let content = `
    <div class="bio-list-popup">
      <h4>该位置的生物</h4>
    `;
    bioList.forEach((bio, index) => {
      content += `
      <div class="bio-item" onclick="showBioDetail('${lngLatKey}', ${index})">
        ${bio.bioName} (${bio.bioType === 'plant' ? '植物' : '动物'})
      </div>
      `;
    });
    content += `</div>`;

    // 打开弹窗
    infoWindow.setContent(content);
    infoWindow.open(map, [lng, lat]);
  });

  // 添加标记到地图
  marker.addTo(map);
}

// ========== 5. 显示生物详情弹窗 ==========
function showBioDetail(lngLatKey, index) {
  const bio = bioData[lngLatKey][index];
  // 构建详情弹窗
  const content = `
    <div class="bio-detail-popup">
      <h3>${bio.bioName}</h3>
      <span class="bio-type-tag">${bio.bioType === 'plant' ? '植物' : '动物'}</span>
      <div class="bio-desc"><strong>位置：</strong>${bio.address}</div>
      <img src="${bio.imgUrl.startsWith('http') ? bio.imgUrl : 'https://' + bio.imgUrl}" 
     alt="${bio.bioName}" crossorigin="anonymous">
      <div class="bio-desc"><strong>介绍：</strong>${bio.bioDesc}</div>
      <div class="bio-meta">上传时间：${bio.uploadTime}</div>
    </div>
  `;

  // 更新弹窗并打开
  infoWindow.setContent(content);
  const [lng, lat] = lngLatKey.split('_');
  infoWindow.open(map, [parseFloat(lng), parseFloat(lat)]);
}

// ========== 6. 高德地址解析（文字地址转经纬度） ==========
function getLngLatFromAddress(address) {
  return new Promise((resolve, reject) => {
    // 生成唯一回调名，避免冲突
    const callbackName = `amap_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
    // 高德地址解析接口（使用Web服务Key）
    const url = `https://restapi.amap.com/v3/geocode/geo?address=${encodeURIComponent(address)}&key=${CONFIG.amap.serviceKey}&output=json&callback=${callbackName}`;
    
    // 注册回调函数
    window[callbackName] = function(data) {
      document.body.removeChild(script);
      delete window[callbackName];
      if (data.status === '1' && data.geocodes.length > 0) {
        const [lng, lat] = data.geocodes[0].location.split(',');
        resolve({ lng: parseFloat(lng), lat: parseFloat(lat) });
      } else {
        reject(`地址解析失败：${data.info || '地址不明确'}`);
      }
    };

    // 创建JSONP请求
    const script = document.createElement('script');
    script.src = url;
    script.onerror = () => {
      document.body.removeChild(script);
      delete window[callbackName];
      reject('地址解析请求失败，请检查网络或高德API Key');
    };
    document.body.appendChild(script);
  });
}

// ========== 7. 生成七牛云上传凭证（修复bad token错误） ==========
function getQiniuToken() {
  try {
    // 修复putPolicy格式，移除多余的region字段
    const putPolicy = {
      scope: CONFIG.qiniu.bucket, // 存储空间名称
      deadline: Math.floor(Date.now() / 1000) + 3600, // 凭证有效期1小时
      returnBody: '{"key":"$(key)","hash":"$(etag)","fsize":$(fsize),"bucket":"$(bucket)","name":"$(x:name)"}'
    };
    
    // 修复编码逻辑：兼容不同浏览器的btoa
    const policyJson = JSON.stringify(putPolicy);
    const encodedPolicy = btoa(unescape(encodeURIComponent(policyJson)));
    
    // 修复HMAC-SHA1签名逻辑
    const secretKey = CONFIG.qiniu.secretKey;
    const hmac = CryptoJS.HmacSHA1(encodedPolicy, secretKey);
    const encodedSign = CryptoJS.enc.Base64.stringify(hmac);
    
    // 最终token
    const token = `${CONFIG.qiniu.accessKey}:${encodedSign}:${encodedPolicy}`;
    console.log('✅ 七牛云Token生成成功：', token);
    return token;
  } catch (err) {
    console.error('❌ 七牛云Token生成失败：', err);
    throw new Error(`生成上传凭证失败：${err.message}`);
  }
}

// ========== 8. 七牛云图片上传（优化错误提示） ==========
function uploadImageToQiniu(file) {
  return new Promise((resolve, reject) => {
    try {
      const token = getQiniuToken();
      // 生成唯一文件名
      const fileName = `bio_${Date.now()}_${Math.random().toString(36).slice(2,8)}.${file.name.split('.').pop()}`;
      
      console.log('🔍 开始上传图片到七牛云：', fileName);
      // 七牛上传实例（修复region配置）
      const observable = qiniu.upload(file, fileName, token, {
        useCdnDomain: true,
        region: CONFIG.qiniu.region
      }, {
        // 自定义变量，可选
        x: {
          name: file.name
        }
      });

      // 监听上传状态
      observable.subscribe({
        next: (res) => {
          console.log('🔍 上传进度：', res.total.percent);
        },
        error: (err) => {
          console.error('❌ 七牛云上传失败：', err);
          reject(`图片上传失败：${err.message}\n请检查七牛云密钥/存储空间/区域配置`);
        },
        complete: (res) => {
          const imgUrl = `${CONFIG.qiniu.domain}/${res.key}`;
          console.log('✅ 七牛云上传成功：', imgUrl);
          resolve(imgUrl);
        }
      });
    } catch (err) {
      reject(`上传初始化失败：${err.message}`);
    }
  });
}

// ========== 9. 核心：上传生物信息到Bmob（表名已修正） ==========
async function uploadBioInfo() {
  // 1. 获取表单输入
  const bioType = document.getElementById('bioType').value;
  const bioName = document.getElementById('bioName').value.trim();
  const address = document.getElementById('address').value.trim();
  const bioDesc = document.getElementById('bioDesc').value.trim();
  const file = document.getElementById('fileInput').files[0];

  // 2. 输入校验
  if (!bioName) return alert('请输入生物名称！');
  if (!address) return alert('请输入位置名称！');
  if (!bioDesc) return alert('请输入生物介绍！');
  if (!file) return alert('请选择生物图片！');

  try {
    // 3. 解析地址为经纬度
    alert('正在解析位置，请稍等...');
    console.log('🔍 开始解析地址：', address);
    const { lng, lat } = await getLngLatFromAddress(address);
    console.log('✅ 地址解析成功：', lng, lat);
    
    // 4. 上传图片到七牛云
    alert(`位置解析成功！\n经度：${lng}，纬度：${lat}\n开始上传图片...`);
    const imgUrl = await uploadImageToQiniu(file);
    console.log('✅ 图片上传成功：', imgUrl);
    
    // 5. 组装数据并上传到Bmob（表名已修正）
    const uploadTime = new Date().toLocaleString();
    const postData = {
      bioType, bioName, address, bioDesc, imgUrl, uploadTime, lng, lat
    };
    console.log('🔍 准备上传到Bmob的数据：', postData);

    const response = await fetch(`${CONFIG.bmob.baseUrl}/${CONFIG.bmob.tableName}`, {
      method: 'POST',
      headers: {
        'X-Bmob-Application-Id': CONFIG.bmob.appId,
        'X-Bmob-REST-API-Key': CONFIG.bmob.restKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(postData)
    });

    console.log('🔍 Bmob上传响应状态：', response.status);
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Bmob上传失败：${response.status} - ${JSON.stringify(errorData)}`);
    }
    
    const result = await response.json();
    console.log('✅ Bmob上传成功：', result);
    
    // 6. 更新本地数据并添加地图标记
    const lngLatKey = `${lng}_${lat}`;
    if (!bioData[lngLatKey]) bioData[lngLatKey] = [];
    bioData[lngLatKey].push({
      bioType, bioName, address, bioDesc, imgUrl, uploadTime, lng, lat
    });

    // 7. 添加标记并定位到该位置
    createBioMarker(lng, lat);
    map.setCenter([lng, lat]);
    map.setZoom(15);

    // 8. 反馈结果+清空表单
    alert(`✅ ${bioName} 上传成功！数据已保存到Bmob云数据库。`);
    document.getElementById('bioName').value = '';
    document.getElementById('address').value = '';
    document.getElementById('bioDesc').value = '';
    document.getElementById('fileInput').value = '';

  } catch (err) {
    alert(`上传失败：${err.message}`);
    console.error('详细错误：', err);
  }
}