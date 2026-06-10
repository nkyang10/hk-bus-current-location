/**
 * UIManager — handles all DOM manipulation via jQuery.
 * Renders landing page, route view, stop list, debug panel, etc.
 */
class UIManager {
  constructor(lang) {
    this.lang = lang
    this._debugOpen = false
    this._logInterval = null
    this._locMgr = null
  }

  // ---------- Top-level render ----------

  renderLanding(company) {
    const co = company || 'kmb'
    const recent = this._getRecent()
    const isCtb = co === 'ctb'
    const title = isCtb
      ? this.lang.t('城巴即時到站', 'CTB Bus Tracker', '城巴即时到站')
      : this.lang.t('九巴即時到站', 'KMB Bus Tracker', '九巴即时到站')
    const sub = isCtb
      ? this.lang.t('即時查詢城巴路線預計到站時間', 'Real-time CTB bus arrival estimates', '即时查询城巴路线预计到站时间')
      : this.lang.t('即時查詢九巴及龍運路線預計到站時間', 'Real-time KMB & LWB bus arrival estimates', '即时查询九巴及龙运路线预计到站时间')
    const placeholder = this.lang.t('輸入路線 e.g. 1, 5B, 10', 'Search route... e.g. 1, 5B, 10', '输入路线 e.g. 1, 5B, 10')
    const dataSrc = isCtb
      ? this.lang.t('資料來源: data.gov.hk / 城巴 CTB', 'Data source: data.gov.hk / CTB', '数据来源: data.gov.hk / 城巴 CTB')
      : this.lang.t('資料來源: data.gov.hk / 九巴 KMB', 'Data source: data.gov.hk / KMB', '数据来源: data.gov.hk / 九巴 KMB')

    $('#app').html(`
      <div class="landing ${isCtb ? 'landing-ctb' : ''}">
        <header class="landing-header">
          <div class="company-toggle">
            <button class="company-btn ${!isCtb ? 'active' : ''}" data-company="kmb">${this.lang.t('九巴 KMB', 'KMB', '九巴 KMB')}</button>
            <button class="company-btn ${isCtb ? 'active' : ''}" data-company="ctb">${this.lang.t('城巴 CTB', 'CTB', '城巴 CTB')}</button>
          </div>
          <div class="header-right">
            <span class="version-badge">v${APP_VERSION}</span>
            <span class="loc-indicator loc-indicator-unknown" id="locIndicator" title="Location not requested">⊙</span>
            <button class="lang-btn" id="langBtn">${this.lang.label}</button>
          </div>
        </header>
        <main class="landing-main">
          <div class="landing-icon">🚌</div>
          <h1 class="landing-title">${title}</h1>
          <p class="landing-sub">${sub}</p>
          <form id="searchForm" class="search-form">
            <input type="text" id="searchInput" class="search-input" placeholder="${placeholder}" autofocus>
            <button type="submit" class="search-btn">${this.lang.t('搜尋', 'GO', '搜寻')}</button>
          </form>
          ${recent.length ? this._renderRecent(recent) : ''}
          <div class="landing-footer">
            <p>${dataSrc}</p>
            <p>${this.lang.t('每30秒自動更新', 'Auto-refresh every 30s', '每30秒自动更新')}</p>
          </div>
        </main>
      </div>
    `)
  }

  renderRouteView(route, bound, company) {
    const co = company || 'kmb'
    const isCtb = co === 'ctb'
    const boundLabel = bound === 'O'
      ? this.lang.t('往 Outbound', 'Outbound', '往 Outbound')
      : this.lang.t('返 Inbound', 'Inbound', '返 Inbound')

    const coLabel = isCtb
      ? this.lang.t('城巴 CTB', 'CTB', '城巴 CTB')
      : this.lang.t('九巴 KMB', 'KMB', '九巴 KMB')

    const routeDataSrc = isCtb
      ? this.lang.t('資料來源: data.gov.hk / 城巴 CTB', 'Data source: data.gov.hk / CTB', '数据来源: data.gov.hk / 城巴 CTB')
      : this.lang.t('資料來源: data.gov.hk / 九巴 KMB', 'Data source: data.gov.hk / KMB', '数据来源: data.gov.hk / 九巴 KMB')

    $('#app').html(`
      <div class="route-view ${isCtb ? 'route-view-ctb' : ''}">
        <div class="route-header ${isCtb ? 'route-header-ctb' : ''}" id="routeHeader">
          <div class="route-header-top">
            <div class="route-title-row">
              <span class="route-header-bar">
                <h1 class="route-number">${route}</h1>
                <span class="bound-badge">${boundLabel}</span>
              </span>
              <span class="route-company" id="routeCompany">${coLabel}</span>
            </div>
            <div class="route-dest-row">
              <span class="route-dest" id="routeDest">—</span>
              <span class="version-badge version-badge-header">v${APP_VERSION}</span>
              <span class="loc-indicator loc-indicator-unknown" id="locIndicator" title="Location not requested">⊙</span>
            </div>
          </div>
        </div>

        <div class="toolbar">
          <form id="searchForm" class="toolbar-search">
            <button type="button" class="back-btn" id="backBtn">‹</button>
            <input type="text" id="searchInput" class="search-input toolbar-input" value="${route}" placeholder="${this.lang.t('輸入路線', 'Search route', '输入路线')}">
            <button type="submit" class="search-btn-small">${this.lang.t('搜尋', 'GO', '搜寻')}</button>
          </form>
          <div class="company-toggle company-toggle-sm">
            <button class="company-btn ${!isCtb ? 'active' : ''}" data-company="kmb">${this.lang.t('九巴 KMB', 'KMB', '九巴 KMB')}</button>
            <button class="company-btn ${isCtb ? 'active' : ''}" data-company="ctb">${this.lang.t('城巴 CTB', 'CTB', '城巴 CTB')}</button>
          </div>
          <button class="lang-btn" id="langBtn">${this.lang.label}</button>
        </div>

        <div class="bound-toggle" id="boundToggle">
          <button class="bound-btn ${bound === 'O' ? 'active' : ''}" data-bound="O">&nbsp;</button>
          <button class="bound-btn ${bound === 'I' ? 'active' : ''}" data-bound="I">&nbsp;</button>
        </div>

        <div class="eta-bar" id="etaBar" style="display:none">
          <div class="spinner"></div>
          <span>${this.lang.t('更新中...', 'Updating...', '更新中...')}</span>
        </div>

        <div class="view-container">
          <div class="stop-list" id="stopList"></div>
          <div class="map-view" id="mapView" style="display:none">
            <div id="routeMap"></div>
          </div>
        </div>

        <div class="route-footer">
          <p>${routeDataSrc} | ${this.lang.t('每30秒自動更新', 'Auto-refresh every 30s', '每30秒自动更新')}</p>
        </div>
      </div>
    `)

    $('#backBtn').on('click', () => $(document).trigger('nav:landing'))
    $('#boundToggle').on('click', '.bound-btn', (e) => {
      const b = $(e.currentTarget).data('bound')
      $(document).trigger('nav:bound', [b])
    })
  }

  updateRouteCompany(company) {
    const isCtb = company === 'ctb'
    const label = isCtb ? this.lang.t('城巴 CTB', 'CTB', '城巴 CTB') : this.lang.t('九巴 KMB', 'KMB', '九巴 KMB')
    $('#routeCompany').text(label)
    $('#app > .route-view').toggleClass('route-view-ctb', isCtb)
    $('#app .route-header').toggleClass('route-header-ctb', isCtb)
  }



  updateRouteInfo(info) {
    if (!info) return
    const orig = this.lang.t(info.orig_tc, info.orig_en, info.orig_sc)
    const dest = this.lang.t(info.dest_tc, info.dest_en, info.dest_sc)
    $('#routeDest').html(`${orig} <span class="dest-arrow">→</span> ${dest}`)
  }

  updateBoundToggle(bound) {
    $('#boundToggle .bound-btn').removeClass('active')
    $(`#boundToggle .bound-btn[data-bound="${bound}"]`).addClass('active')
  }

  updateBoundToggleDestinations(info, otherInfo, currentBound) {
    if (!info) return
    const dest = this.lang.t(info.dest_tc, info.dest_en, info.dest_sc)
    $(`#boundToggle .bound-btn[data-bound="${currentBound}"]`).text(dest)
    const otherBound = currentBound === 'O' ? 'I' : 'O'
    if (otherInfo) {
      const otherDest = this.lang.t(otherInfo.dest_tc, otherInfo.dest_en, otherInfo.dest_sc)
      $(`#boundToggle .bound-btn[data-bound="${otherBound}"]`).text(otherDest)
    } else {
      const fallback = this.lang.t(info.orig_tc, info.orig_en, info.orig_sc)
      $(`#boundToggle .bound-btn[data-bound="${otherBound}"]`).text(fallback)
    }
  }

  updateRouteHeaderSvc(types) {
    const existing = $('#routeHeader .svc-badge')
    if (types && types.length > 1) {
      if (existing.length) existing.text(types.map(s => 'S' + s).join('/'))
      else $('.route-title-row').append(`<span class="svc-badge">${types.map(s => 'S' + s).join('/')}</span>`)
    }
  }

  // ---------- Stop list ----------

  renderStopList(stops, etaMap, isCtb) {
    const $list = $('#stopList')
    if (!stops || stops.length === 0) {
      const msg = isCtb
        ? this.lang.t('暫無站點資料 - 城巴API數據暫不可用', 'CTB stop data currently unavailable', '暂无站点数据 - 城巴API数据暂不可用')
        : this.lang.t('沒有站點資料', 'No stops data', '没有站点数据')
      $list.html(`<div class="empty-state">🚌<p>${msg}</p></div>`)
      return
    }

    const busPositions = this._getBusPositions(stops, etaMap)
    const busAfter = new Set(busPositions.map(p => p.afterSeq))

    let html = ''
    for (let i = 0; i < stops.length; i++) {
      const stop = stops[i]
      const etaArr = etaMap[String(stop.seq)] || []
      const etaText = this._formatEta(etaArr)
      const name = this.lang.t(stop.name_tc, stop.name_en, stop.name_sc)

      const svcBadges = stop.serviceTypes && stop.serviceTypes.length > 1
        ? stop.serviceTypes.map(s => `<span class="svc-tag">${s}</span>`).join('')
        : ''

      html += `<div class="stop-row" data-seq="${i + 1}" data-stop-id="${stop.stopId}" data-lat="${stop.lat != null ? stop.lat : ''}" data-long="${stop.long != null ? stop.long : ''}">`
      html += `<div class="stop-seq-col"><span class="stop-seq ${etaText.cls}">${i + 1}</span>`
      if (i < stops.length - 1) html += '<div class="stop-line"></div>'
      html += '</div>'
      html += `<div class="stop-info-col"><div class="stop-name-row"><span class="stop-name">${name}</span>${svcBadges}</div></div>`
      html += `<div class="stop-eta-col">${etaText.html}<div class="walk-dist-slot" data-seq="${i + 1}"></div></div>`
      html += '</div>'

      if (busAfter.has(stop.seq)) {
        html += '<div class="bus-indicator-row"><div class="stop-seq-col"><span class="bus-icon">🚌</span></div></div>'
      }
    }

    $list.html(html)
  }

  showStopListLoading() {
    $('#stopList').html(`
      <div class="loading-spinner">
        <div class="spinner"></div>
        <p>${this.lang.t('載入站點中...', 'Loading stops...', '加载站点中...')}</p>
      </div>
    `)
  }

  showError(msg) {
    $('#stopList').html(`
      <div class="error-state">
        <div class="error-icon">⚠️</div>
        <p>${msg}</p>
        <button class="retry-btn" id="retryBtn">${this.lang.t('重試', 'Retry', '重试')}</button>
      </div>
    `)
    $('#retryBtn').on('click', () => $(document).trigger('nav:retry'))
  }

  showEtaLoading(v) {
    $('#etaBar').toggle(v)
  }

  setLocMgr(locMgr) {
    this._locMgr = locMgr
  }

  updateLocationStatus() {
    if (!this._locMgr) return
    const status = this._locMgr.getStatus()
    $('.loc-indicator')
      .attr('class', 'loc-indicator loc-indicator-' + status)
      .attr('title', status === 'granted' ? 'Location available' : status === 'denied' ? 'Location denied — click to retry' : status === 'unavailable' ? 'Geolocation not supported' : 'Location not requested')
      .text(status === 'granted' ? '◉' : '⊙')
  }

  bindLocationEvents(app) {
    $(document).on('click', '.loc-indicator', function () {
      if (app._locationReady) return
      $(this).text('...')
      app.locMgr.retry().then((granted) => {
        app._locationReady = granted
        app.ui.updateLocationStatus()
        if (granted) {
          app.locMgr.onPosition((pos) => {
            app.ui.updateLocationStatus()
            if (app.mapMgr.isVisible()) {
              app.mapMgr.updateUserPosition(pos)
            }
            if (app._stopsLoaded) {
              app._applyLocationFeatures()
            }
          })
          if (app._stopsLoaded) {
            app._applyLocationFeatures()
          }
        }
      })
    })
  }

  scrollToNearestStop(stops) {
    if (!this._locMgr || !this._locMgr.isPermitted()) return
    const nearest = this._locMgr.getNearestStops(stops, 1)
    if (nearest.length === 0) return
    const targetSeq = nearest[0].stop.seq
    const $container = $('.view-container')
    const $target = $(`.stop-row[data-seq="${targetSeq}"]`)
    if ($target.length === 0) return
    const containerHeight = $container.height()
    const rowHeight = $target.outerHeight(true)
    const offset = $target.position().top
    const scrollTop = offset - containerHeight / 2 + rowHeight / 2
    $container.animate({ scrollTop: Math.max(0, scrollTop) }, 400)
  }

  async showWalkingDistances(stops) {
    if (!this._locMgr || !this._locMgr.isPermitted()) return
    const nearest = this._locMgr.getNearestStops(stops, 4)
    if (nearest.length === 0) return
    const userPos = this._locMgr.getPosition()
    if (!userPos) return

    $('.stop-row').removeClass('nearest-stop')
    nearest.forEach(n => {
      $(`.stop-row[data-seq="${n.stop.seq}"]`).addClass('nearest-stop')
    })

    // Cache for walking distances to avoid flicker on re-render
    if (!this._walkCache) this._walkCache = {}

    // Show cached values immediately, or "..." for new ones
    const userKey = `${Math.round(userPos.lat*100)},${Math.round(userPos.lng*100)}`
    for (const n of nearest) {
      const $slot = $(`.walk-dist-slot[data-seq="${n.stop.seq}"]`)
      if ($slot.length === 0) continue
      const cacheKey = `${userKey}-${n.stop.lat},${n.stop.long}`
      if (this._walkCache[cacheKey]) {
        $slot.html(this._walkCache[cacheKey])
      } else {
        $slot.html('<span class="walk-dist-loading">...</span>')
      }
    }

    // Fetch distances in parallel
    const fetchPromises = nearest.map(async (n) => {
      const $slot = $(`.walk-dist-slot[data-seq="${n.stop.seq}"]`)
      if ($slot.length === 0) return
      const cacheKey = `${userKey}-${n.stop.lat},${n.stop.long}`
      try {
        const result = await this._locMgr.fetchWalkingDistance(userPos, { lat: n.stop.lat, lng: n.stop.long })
        let html
        if (result && result.distance > 0) {
          const dist = result.distance < 1000
            ? Math.round(result.distance) + 'm'
            : (result.distance / 1000).toFixed(1) + 'km'
          const dur = Math.round(result.distance / 80)  // ~5km/h walking pace
          const durLabel = this.lang.t(`${dur}分鐘`, `${dur}min`, `${dur}分钟`)
          html = `<span class="walk-dist">🚶&nbsp;${dist}&nbsp;·&nbsp;${durLabel}</span>`
        }
        if (html) {
          this._walkCache[cacheKey] = html
          $slot.html(html)
        } else {
          $slot.html('')
        }
      } catch {
        $slot.html('')
      }
    })
    await Promise.all(fetchPromises)
  }

  bindStopClickEvents(app) {
    $(document).on('click', '#stopList .stop-row', function () {
      const seq = $(this).data('seq')
      const lat = parseFloat($(this).data('lat'))
      const lng = parseFloat($(this).data('long'))
      const name = $(this).find('.stop-name').text()
      if (!isNaN(lat) && !isNaN(lng)) {
        $(document).trigger('stop:click', [{ seq, lat, lng, name }])
      }
    })
  }

  // ---------- Floating action buttons ----------

  renderDebugButton() {
    if ($('#debugBtn').length) return
    $('body').append(`<button class="debug-btn" id="debugBtn">🐛</button>`)
    $('#debugBtn').on('click', () => $(document).trigger('debug:toggle'))
  }

  renderMapButton() {
    if ($('#mapToggleBtn').length) return
    $('body').append(`<button class="map-toggle-btn" id="mapToggleBtn" style="display:none">🗺️</button>`)
    $('#mapToggleBtn').on('click', () => $(document).trigger('view:toggle'))
  }

  showMapButton(v) {
    $('#mapToggleBtn').toggle(v)
  }

  setMapButtonIcon(icon) {
    $('#mapToggleBtn').text(icon)
  }

  openDebugPanel() {
    this._debugOpen = true
    if ($('#debugPanel').length) return
    const $panel = $(`
      <div class="debug-overlay" id="debugPanel">
        <div class="debug-modal">
          <div class="debug-header">
            <span class="debug-title">🐛 Debug Log <span class="debug-count" id="debugCount">0</span></span>
            <div class="debug-actions">
              <button class="debug-btn-sm" id="debugAutoScroll">Auto ${this._logAutoScroll !== false ? 'ON' : 'OFF'}</button>
              <button class="debug-btn-sm" id="debugClear">🗑️</button>
              <button class="debug-btn-copy" id="debugCopy">📋 Copy All Log</button>
            </div>
          </div>
          <div class="debug-filter">
            <input type="text" id="debugFilter" placeholder="Filter logs..." class="debug-filter-input">
          </div>
          <div class="debug-body" id="debugBody"></div>
          <div class="debug-footer">
            <span id="debugStats">0 entries</span>
            <span>v2.1</span>
          </div>
        </div>
      </div>
    `)
    $('body').append($panel)
    $panel.on('click', (e) => { if (e.target === e.currentTarget) this.closeDebugPanel() })

    $('#debugCopy').on('click', () => this._copyLogs())
    $('#debugClear').on('click', () => { Logger.clear(); this._refreshDebugLog() })
    $('#debugAutoScroll').on('click', function() {
      const on = $(this).text().includes('ON')
      $(this).text(on ? 'Auto OFF' : 'Auto ON')
      window._debugAutoScroll = !on
    })
    $('#debugFilter').on('input', () => this._refreshDebugLog())
    this._logAutoScroll = true
    this._refreshDebugLog()
    if (this._logInterval) clearInterval(this._logInterval)
    this._logInterval = setInterval(() => this._refreshDebugLog(), 1000)
  }

  closeDebugPanel() {
    this._debugOpen = false
    if (this._logInterval) { clearInterval(this._logInterval); this._logInterval = null }
    $('#debugPanel').remove()
  }

  _refreshDebugLog() {
    const filter = String($('#debugFilter').val() || '').toLowerCase()
    let logs = Logger.getAll()
    if (filter) logs = logs.filter(e =>
      e.level.toLowerCase().includes(filter) ||
      e.cat.toLowerCase().includes(filter) ||
      e.msg.toLowerCase().includes(filter)
    )
    $('#debugCount').text(Logger.size)
    $('#debugStats').text(`${Logger.size} entries${filter ? `, filtered: ${logs.length}` : ''}`)

    const body = $('#debugBody')
    if (!body.length) return
    let html = ''
    logs.forEach(e => {
      const time = new Date(e.ts).toLocaleTimeString()
      html += `<div class="log-line">
        <span class="log-time">${time}</span>
        <span class="log-lvl log-${e.level.toLowerCase()}">${e.level}</span>
        <span class="log-cat">[${e.cat}]</span>
        <span class="log-msg">${this._esc(e.msg)}</span>
        ${e.data ? `<pre class="log-data">${this._esc(e.data)}</pre>` : ''}
      </div>`
    })
    body.html(html || '<div class="log-empty">No entries</div>')
    if (window._debugAutoScroll !== false) body.scrollTop(body[0].scrollHeight)
  }

  _copyLogs() {
    const text = Logger.getPlainText()
    navigator.clipboard.writeText(text).then(() => {
      $('#debugCopy').text('✅ Copied!')
      setTimeout(() => $('#debugCopy').text('📋 Copy All Log'), 2000)
    }).catch(() => {
      const ta = document.createElement('textarea')
      ta.value = text
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    })
  }

  // ---------- Helpers ----------

  _getBusPositions(stops, etaMap) {
    const now = new Date()
    const positions = []
    for (let i = 0; i < stops.length - 1; i++) {
      const cur = stops[i]
      const next = stops[i + 1]
      const curEtas = (etaMap[String(cur.seq)] || [])
        .filter(e => e.eta && new Date(e.eta) > now)
        .sort((a, b) => new Date(a.eta) - new Date(b.eta))
      const nextEtas = (etaMap[String(next.seq)] || [])
        .filter(e => e.eta && new Date(e.eta) > now)
        .sort((a, b) => new Date(a.eta) - new Date(b.eta))
      const curFirst = curEtas.length > 0 ? new Date(curEtas[0].eta) : null
      const nextFirst = nextEtas.length > 0 ? new Date(nextEtas[0].eta) : null
      if (nextFirst && (!curFirst || nextFirst < curFirst)) {
        positions.push({ afterSeq: cur.seq })
      }
    }
    return positions
  }

  _formatEta(etaArr) {
    if (!etaArr || etaArr.length === 0) return { cls: '', html: '<span class="eta-none">—</span>' }

    const now = new Date()
    const future = etaArr
      .filter(e => e.eta && new Date(e.eta) > now)
      .sort((a, b) => new Date(a.eta) - new Date(b.eta))
    const best = future.length > 0 ? future[0] : etaArr[0]
    if (!best || !best.eta) return { cls: '', html: '<span class="eta-none">—</span>' }

    const diffMs = new Date(best.eta) - now
    const diffMin = Math.floor(diffMs / 60000)
    const diffSec = Math.round(diffMs / 1000)

    let text, cls
    if (diffSec < -60) { text = this.lang.t('已開出', 'Departed', '已开出'); cls = 'eta-departed' }
    else if (diffSec < 0) { text = this.lang.t('即將到站', 'Arriving', '即将到站'); cls = 'eta-arriving' }
    else if (diffMin === 0) { text = this.lang.t('到站', 'Due', '到站'); cls = 'eta-due' }
    else if (diffMin <= 3) { text = `${diffMin} ${this.lang.t('分鐘', 'min', '分钟')}`; cls = 'eta-soon' }
    else { text = `${diffMin} ${this.lang.t('分鐘', 'min', '分钟')}`; cls = 'eta-normal' }

    const dest = best.dest_en ? `<span class="eta-dest">${this.lang.t(best.dest_tc, best.dest_en, best.dest_sc)}</span>` : ''
    const rmk = best.rmk_en && best.rmk_en !== 'Scheduled Bus' ? `<span class="eta-rmk">${this._esc(this.lang.t(best.rmk_tc, best.rmk_en, best.rmk_sc))}</span>` : ''

    return {
      cls: `seq-${cls}`,
      html: `<div class="eta-val ${cls}">${text}${dest}${rmk}</div>`,
    }
  }

  _getRecent() {
    try { return JSON.parse(localStorage.getItem('hk-bus-recent') || '[]') } catch { return [] }
  }

  _renderRecent(recent) {
    return `
      <div class="recent-section">
        <p class="recent-label">${this.lang.t('最近查詢', 'Recent', '最近查询')}</p>
        <div class="recent-list">
          ${recent.map(r => {
            const route = typeof r === 'string' ? r : r.route
            const company = typeof r === 'string' ? 'kmb' : (r.company || 'kmb')
            const label = company === 'ctb' ? `${route}·CTB` : route
            return `<button class="recent-btn" data-route="${route}" data-company="${company}">${label}</button>`
          }).join('')}
        </div>
      </div>
    `
  }

  _esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }
}
