/**
 * LanguageManager — handles multi-language switching (TC/EN/SC).
 */
class LanguageManager {
  constructor() {
    this.key = 'hk-bus-lang'
    this.labels = { tc: '繁', en: 'EN', sc: '简' }
    this.order = ['tc', 'en', 'sc']
    this._lang = this._load()
  }

  _load() {
    try { return localStorage.getItem(this.key) || 'tc' } catch { return 'tc' }
  }

  _save(v) {
    try { localStorage.setItem(this.key, v) } catch {}
  }

  get lang() { return this._lang }

  setLang(v) {
    if (this.order.includes(v)) {
      this._lang = v
      this._save(v)
    }
  }

  toggle() {
    const idx = this.order.indexOf(this._lang)
    this.setLang(this.order[(idx + 1) % this.order.length])
  }

  get label() { return this.labels[this._lang] }

  t(tc, en, sc) {
    switch (this._lang) {
      case 'en': return en || tc
      case 'sc': return sc || tc
      default: return tc
    }
  }
}
