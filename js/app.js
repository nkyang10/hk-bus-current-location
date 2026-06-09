/**
 * BusTrackerApp — main application controller.
 * Parses URL params, orchestrates RouteManager, EtaManager, MapManager, UIManager.
 */
class BusTrackerApp {
  constructor() {
    this.lang = new LanguageManager()
    this.api = new ApiClient()
    this.routeMgr = new RouteManager(this.api)
    this.etaMgr = new EtaManager(this.api)
    this.mapMgr = new MapManager()
    this.ui = new UIManager(this.lang)

    this._route = ''
    this._bound = 'O'

    this._bindEvents()
  }

  init() {
    Logger.ui('INIT', 'App starting')
    this.ui.renderDebugButton()

    // Parse initial URL params
    const params = new URLSearchParams(window.location.search)
    const route = params.get('route') || ''
    const bound = params.get('bound') || 'O'

    if (route) {
      this._route = route
      this._bound = bound
      this._navigate(route, bound)
    } else {
      this.ui.renderLanding()
      this._bindLandingEvents()
    }
  }

  _bindEvents() {
    $(document).on('nav:landing', () => {
      this._tearDownRoute()
      this._updateUrl('', 'O')
      this._route = ''
      this.ui.renderLanding()
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

    $(document).on('ui:toggleMap', () => {
      this.ui.toggleMap()
      this.mapMgr.invalidateSize()
    })

    $(document).on('map:show', () => {
      this.mapMgr.invalidateSize()
    })

    $(document).on('eta:loading', (e, v) => {
      this.ui.showEtaLoading(v)
    })

    $(document).on('eta:update', (e, map) => {
      const stops = this.routeMgr.getStops()
      const allEta = this.etaMgr.getAllEta()

      // Single call: compute all bus icon placements from raw ETA
      const placements = this.etaMgr.computePlacements(stops)

      // Log all stops with ETA info
      const stopLog = stops.map(s => {
        const items = (map[String(s.seq)] || []).filter(e => e.eta)
        const times = items.map(e => {
          const t = new Date(e.eta)
          return `${t.getHours().toString().padStart(2,'0')}:${t.getMinutes().toString().padStart(2,'0')}`
        }).join(',') || '—'
        return `  #${s.seq} ${s.name_en}: [${times}]`
      }).join('\n')
      Logger.api('STOP_ETA', `${stops.length} stops\n${stopLog}`)

      // Log all bus icon placements
      if (placements.mapPositions.length) {
        const iconLog = placements.mapPositions.map(bp => {
          const fromName = (stops.find(s => s.seq === bp.fromSeq) || {}).name_en || bp.fromSeq
          const toName = (stops.find(s => s.seq === bp.toSeq) || {}).name_en || bp.toSeq
          const pct = Math.round(bp.progress * 100)
          const placement = (bp.type === 'at_stop') ? `AT ${toName}`
            : `BETWEEN ${fromName} → ${toName}`
          return `  🚌 ${placement} (${pct}% @ ${bp.lat.toFixed(5)},${bp.lng.toFixed(5)})`
        }).join('\n')
        Logger.map('BUS_ICONS', `${placements.mapPositions.length} buses\n${iconLog}`)

        this.mapMgr.render(stops, placements.mapPositions)
      }
      this.ui.renderStopList(stops, map, placements)

      // Store debug snapshot for issue reproduction
      Logger.setSnapshot({
        route: this._route,
        bound: this._bound,
        stopCount: stops.length,
        etaTotalCount: allEta.length,
        busPositions: placements.mapPositions,
        sampleEtaItems: allEta.slice(0, 5),
        sampleStops: stops.filter((s, i) => i < 3 || i >= stops.length - 3),
      })
    })

    $(document).on('debug:toggle', () => {
      if (this.ui._debugOpen) this.ui.closeDebugPanel()
      else this.ui.openDebugPanel()
    })
  }

  _bindLandingEvents() {
    $('#searchForm').off('submit').on('submit', (e) => {
      e.preventDefault()
      const val = $('#searchInput').val().trim().toUpperCase()
      if (val) this._searchRoute(val)
    })
    $(document).off('click', '.recent-btn').on('click', '.recent-btn', (e) => {
      const r = $(e.currentTarget).data('route')
      this._searchRoute(r)
    })
    $('#langBtn').off('click').on('click', () => {
      this.lang.toggle()
      this.ui.renderLanding()
      this._bindLandingEvents()
    })
  }

  _bindRouteEvents() {
    $('#searchForm').off('submit').on('submit', (e) => {
      e.preventDefault()
      const val = $('#searchInput').val().trim().toUpperCase()
      if (val) this._searchRoute(val)
    })
    $('#langBtn').off('click').on('click', () => {
      this.lang.toggle()
      this.ui.renderLanding()
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
    Logger.ui('NAV', `Route ${route} bound=${bound}`)
    this.etaMgr.stop()

    this._route = route
    this._bound = bound

    this.ui.renderRouteView(route, bound)
    this._bindRouteEvents()
    this.ui.showStopListLoading()

    // Init map container
    this.mapMgr.init('routeMap')

    try {
      await this.routeMgr.load(route, bound)

      const info = this.routeMgr.getRouteInfo()
      const stops = this.routeMgr.getStops()
      const types = this.routeMgr.getServiceTypes()

      this.ui.updateRouteInfo(info)
      this.ui.updateBoundToggle(bound)
      this.ui.updateRouteHeaderSvc(types)
      this.ui.renderStopList(stops, this.etaMgr.getEtaMap())
      this.mapMgr.render(stops)

      // Start ETA polling — pass current bound to filter direction
      this.etaMgr.start(route, bound, types)

    } catch (err) {
      Logger.error('NAV', `${route} failed`, { error: err.message })
      if (err.message === 'NOT_FOUND') {
        this.ui.showError(this.lang.t('路線不存在', 'Route not found', '路线不存在'))
      } else {
        this.ui.showError(this.lang.t('載入失敗', 'Load failed', '加载失败'))
      }
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
    }
    const qs = params.toString()
    const url = qs ? `${window.location.pathname}?${qs}` : window.location.pathname
    window.history.replaceState({}, '', url)
  }

  _saveRecent(r) {
    try {
      const stored = JSON.parse(localStorage.getItem('hk-bus-recent') || '[]')
      const updated = [r, ...stored.filter(x => x !== r)].slice(0, 8)
      localStorage.setItem('hk-bus-recent', JSON.stringify(updated))
    } catch {}
  }
}
