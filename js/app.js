/**
 * BusTrackerApp — main application controller.
 * Parses URL params, orchestrates RouteManager, EtaManager, UIManager.
 */
class BusTrackerApp {
  constructor() {
    this.lang = new LanguageManager()
    this._company = this._loadCompany()
    this.api = this._createApi()
    this.routeMgr = new RouteManager(this.api)
    this.etaMgr = new EtaManager(this.api)
    this.ui = new UIManager(this.lang)

    this._route = ''
    this._bound = 'O'

    this._bindEvents()
  }

  _loadCompany() {
    try { return localStorage.getItem('hk-bus-company') || 'kmb' } catch { return 'kmb' }
  }

  _saveCompany(v) {
    try { localStorage.setItem('hk-bus-company', v) } catch {}
  }

  _createApi() {
    return this._company === 'ctb' ? new CtbApiClient() : new ApiClient()
  }

  _switchCompany(company) {
    if (company === this._company) return
    this._company = company
    this._saveCompany(company)
    this.api = this._createApi()
    this.routeMgr = new RouteManager(this.api)
    this.etaMgr = new EtaManager(this.api)
    this._tearDownRoute()
    this._route = ''
    this._bound = 'O'
    this._updateUrl('', 'O')
    this.ui.renderLanding(this._company)
    this._bindLandingEvents()
  }

  init() {
    Logger.ui('INIT', 'App starting')
    this.ui.renderDebugButton()

    const params = new URLSearchParams(window.location.search)
    const route = params.get('route') || ''
    const bound = params.get('bound') || 'O'
    const company = params.get('company') || ''

    if (company && (company === 'kmb' || company === 'ctb')) {
      this._company = company
      this._saveCompany(company)
      this.api = this._createApi()
      this.routeMgr = new RouteManager(this.api)
      this.etaMgr = new EtaManager(this.api)
    }

    if (route) {
      this._route = route
      this._bound = bound
      this._navigate(route, bound)
    } else {
      this.ui.renderLanding(this._company)
      this._bindLandingEvents()
    }
  }

  _bindEvents() {
    $(document).on('nav:landing', () => {
      this._tearDownRoute()
      this._updateUrl('', 'O')
      this._route = ''
      this.ui.renderLanding(this._company)
      this._bindLandingEvents()
    })

    $(document).on('nav:bound', (e, bound) => {
      if (this._route) {
        this._bound = bound
        this._updateUrl(this._route, bound)
        this._navigate(this._route, bound)
      }
    })

    $(document).on('nav:retry', () => {
      if (this._route) this._navigate(this._route, this._bound)
    })

    $(document).on('eta:loading', (e, v) => {
      this.ui.showEtaLoading(v)
    })

    $(document).on('eta:update', (e, map) => {
      const stops = this.routeMgr.getStops()
      const allEta = this.etaMgr.getAllEta()

      const stopLog = stops.map(s => {
        const items = (map[String(s.seq)] || []).filter(e => e.eta)
        const times = items.map(e => {
          const t = new Date(e.eta)
          return `${t.getHours().toString().padStart(2,'0')}:${t.getMinutes().toString().padStart(2,'0')}`
        }).join(',') || '—'
        return `  #${s.seq} ${s.name_en}: [${times}]`
      }).join('\n')
      Logger.api('STOP_ETA', `${stops.length} stops\n${stopLog}`)

      this.ui.renderStopList(stops, map, this._company === 'ctb')
    })

    $(document).on('debug:toggle', () => {
      if (this.ui._debugOpen) this.ui.closeDebugPanel()
      else this.ui.openDebugPanel()
    })

    $(document).on('company:switch', (e, company) => {
      this._switchCompany(company)
    })
  }

  _bindLandingEvents() {
    $('#searchForm').on('submit', (e) => {
      e.preventDefault()
      const val = $('#searchInput').val().trim().toUpperCase()
      if (val) this._searchRoute(val)
    })
    $('.recent-btn').on('click', (e) => {
      const r = $(e.currentTarget).data('route')
      const co = $(e.currentTarget).data('company') || 'kmb'
      if (co !== this._company) {
        this._company = co
        this._saveCompany(co)
        this.api = this._createApi()
        this.routeMgr = new RouteManager(this.api)
        this.etaMgr = new EtaManager(this.api)
      }
      this._searchRoute(r)
    })
    $('#langBtn').on('click', () => {
      this.lang.toggle()
      this.ui.renderLanding(this._company)
      this._bindLandingEvents()
    })
  }

  _bindRouteEvents() {
    $('#searchForm').on('submit', (e) => {
      e.preventDefault()
      const val = $('#searchInput').val().trim().toUpperCase()
      if (val) this._searchRoute(val)
    })
    $('#langBtn').on('click', () => {
      this.lang.toggle()
      this.ui.renderLanding(this._company)
      this._bindLandingEvents()
    })
  }

  _searchRoute(route) {
    this._saveRecent(route)
    this._route = route
    this._updateUrl(route, this._bound)
    this._navigate(route, this._bound)
  }

  async _navigate(route, bound) {
    Logger.ui('NAV', `Route ${route} bound=${bound} (${this._company})`)
    this.etaMgr.stop()

    this._route = route
    this._bound = bound

    this.ui.renderRouteView(route, bound, this._company)
    this._bindRouteEvents()
    this.ui.showStopListLoading()

    try {
      await this.routeMgr.load(route, bound)

      const info = this.routeMgr.getRouteInfo()
      const stops = this.routeMgr.getStops()
      const types = this.routeMgr.getServiceTypes()

      this.ui.updateRouteInfo(info)
      this.ui.updateBoundToggle(bound)
      this.ui.updateRouteHeaderSvc(types)
      this.ui.updateRouteCompany(this._company)
      this.ui.renderStopList(stops, this.etaMgr.getEtaMap(), this._company === 'ctb')
 
      const stopIds = this._company === 'ctb' ? stops.map(s => s.stopId) : null
      this.etaMgr.start(route, bound, types, stopIds)

    } catch (err) {
      Logger.error('NAV', `${route} failed`, { error: err.message })
      if (err.message === 'NOT_FOUND') {
        this.ui.showError(this.lang.t('路線不存在', 'Route not found', '路线不存在'))
      } else {
        this.ui.showError(this.lang.t('載入失敗', 'Load failed', '加载失败'))
      }
      // Stop ETA polling if navigation failed
      this.etaMgr.stop()
    }
  }

  _tearDownRoute() {
    this.etaMgr.stop()
    this.routeMgr.abort()
  }

  _updateUrl(route, bound) {
    const params = new URLSearchParams()
    if (route) {
      params.set('route', route)
      params.set('bound', bound)
      params.set('company', this._company)
    }
    const qs = params.toString()
    const url = qs ? `${window.location.pathname}?${qs}` : window.location.pathname
    window.history.replaceState({}, '', url)
  }

  _saveRecent(r) {
    try {
      const stored = JSON.parse(localStorage.getItem('hk-bus-recent') || '[]')
      const entry = { route: r, company: this._company }
      const updated = [entry, ...stored.filter(x => {
        if (typeof x === 'string') return x !== r
        return x.route !== r || x.company !== this._company
      })].slice(0, 8)
      localStorage.setItem('hk-bus-recent', JSON.stringify(updated))
    } catch {}
  }
}
