class KokomoEventsApp {
  constructor() {
    this.events = [];
    this.filteredEvents = [];
    this.currentView = 'list';
    this.currentMonth = new Date().getMonth();
    this.currentYear = new Date().getFullYear();
    this.filters = {
      search: '',
      date: 'all',
      category: 'all',
      source: 'all',
      kaaOnly: false
    };

    this.init();
  }

  async init() {
    this.showLoading();
    await this.loadEvents();
    this.setupEventListeners();
    this.populateFilterOptions();
    this.applyFilters();
    this.updateStats();
    this.renderCurrentView();
    this.hideLoading();
  }

  async loadEvents() {
    // Fetch events from backend API
    try {
      const res = await fetch('/api/events');
      if (!res.ok) throw new Error('Failed to fetch events');
      const data = await res.json();
      this.events = data.map(ev => ({
        ...ev,
        startDate: new Date(ev.start_date),
        endDate: ev.end_date ? new Date(ev.end_date) : null
      }));
    } catch (err) {
      alert('Could not load events. Please try again later.');
      this.events = [];
    }
  }

  setupEventListeners() {
    // Tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const view = e.currentTarget.dataset.view;
        this.switchView(view);
      });
    });

    // Search
    document.getElementById('searchInput').addEventListener('input', (e) => {
      this.filters.search = e.target.value;
      this.applyFilters();
    });

    // Dropdown filters
    document.getElementById('dateFilter').addEventListener('change', (e) => {
      this.filters.date = e.target.value;
      this.applyFilters();
    });
    document.getElementById('categoryFilter').addEventListener('change', (e) => {
      this.filters.category = e.target.value;
      this.applyFilters();
    });
    document.getElementById('sourceFilter').addEventListener('change', (e) => {
      this.filters.source = e.target.value;
      this.applyFilters();
    });
    document.getElementById('kaaFilter').addEventListener('change', (e) => {
      this.filters.kaaOnly = e.target.checked;
      this.applyFilters();
    });

    // Clear filters
    document.getElementById('clearFilters').addEventListener('click', () => this.clearFilters());

    // Sort
    document.getElementById('sortBy').addEventListener('change', () => this.renderListView());

    // Calendar nav
    document.getElementById('prevMonth').addEventListener('click', () => {
      this.currentMonth--;
      if (this.currentMonth < 0) {
        this.currentMonth = 11;
        this.currentYear--;
      }
      this.renderCalendarView();
    });
    document.getElementById('nextMonth').addEventListener('click', () => {
      this.currentMonth++;
      if (this.currentMonth > 11) {
        this.currentMonth = 0;
        this.currentYear++;
      }
      this.renderCalendarView();
    });

    // Modal close
    document.getElementById('closeModal').addEventListener('click', () => this.closeModal());
    document.getElementById('closeModalBtn').addEventListener('click', () => this.closeModal());
    // Close on overlay click
    document.getElementById('eventModal').addEventListener('click', (e) => {
      if (e.target.id === 'eventModal') this.closeModal();
    });

    // Export
    document.getElementById('exportBtn').addEventListener('click', () => this.exportEvents());
  }

  populateFilterOptions() {
    const catSelect = document.getElementById('categoryFilter');
    const srcSelect = document.getElementById('sourceFilter');
    const cats = [...new Set(this.events.map(e => e.category))].sort();
    const srcs = [...new Set(this.events.map(e => e.source))].sort();

    cats.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat.toLowerCase();
      opt.textContent = cat;
      catSelect.appendChild(opt);
    });
    srcs.forEach(src => {
      const opt = document.createElement('option');
      opt.value = src.toLowerCase();
      opt.textContent = src;
      srcSelect.appendChild(opt);
    });
  }

  applyFilters() {
    this.filteredEvents = this.events.filter(ev => {
      // Search
      if (this.filters.search) {
        const q = this.filters.search.toLowerCase();
        if (!(ev.title + ' ' + (ev.description || '')).toLowerCase().includes(q)) {
          return false;
        }
      }
      // Date filters
      const today = new Date();
      today.setHours(0,0,0,0);
      const evDate = new Date(ev.startDate); evDate.setHours(0,0,0,0);
      switch(this.filters.date){
        case 'today': if(evDate.getTime()!==today.getTime()) return false; break;
        case 'week': {
          const week = new Date(today); week.setDate(week.getDate()+7);
          if(evDate< today || evDate> week) return false; break;
        }
        case 'month': if(evDate.getMonth()!==today.getMonth() || evDate.getFullYear()!==today.getFullYear()) return false; break;
        case 'upcoming': if(evDate< today) return false; break;
      }
      // Category
      if(this.filters.category!=='all' && ev.category.toLowerCase()!==this.filters.category) return false;
      // Source
      if(this.filters.source!=='all' && ev.source.toLowerCase()!==this.filters.source) return false;
      // KAA
      if(this.filters.kaaOnly && !ev.kaa_relevant) return false;
      return true;
    });

    this.updateStats();
    this.renderCurrentView();
    this.renderTodayHighlights();
  }

  updateStats() {
    const today = new Date(); today.setHours(0,0,0,0);
    const todayEvents = this.events.filter(ev => ev.startDate.toDateString()===today.toDateString());
    const kaaEvents = this.events.filter(ev => ev.kaa_relevant);
    document.getElementById('totalEvents').textContent = this.events.length;
    document.getElementById('todayEvents').textContent = todayEvents.length;
    document.getElementById('kaaEvents').textContent = kaaEvents.length;
    document.getElementById('resultsCount').textContent = `${this.filteredEvents.length} events found`;
  }

  switchView(view){
    this.currentView = view;
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.view===view));
    document.querySelectorAll('.view-container').forEach(ctn => ctn.classList.toggle('active', ctn.id===view+'View'));
    this.renderCurrentView();
  }

  renderCurrentView(){
    if(this.currentView==='list') this.renderListView(); else this.renderCalendarView();
  }

  renderListView(){
    const sort = document.getElementById('sortBy').value;
    const sorted = [...this.filteredEvents].sort((a,b)=>{
      switch(sort){
        case 'date': return a.startDate-b.startDate;
        case 'title': return a.title.localeCompare(b.title);
        case 'category': return a.category.localeCompare(b.category);
        case 'source': return a.source.localeCompare(b.source);
        default: return 0;
      }
    });
    const grid = document.getElementById('eventsList');
    grid.innerHTML = sorted.length? sorted.map(ev=>this.eventCardHTML(ev)).join('') : '<p class="no-results">No events found matching your criteria.</p>';
  }

  eventCardHTML(ev){
    const dateStr = ev.startDate.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',year:'numeric'});
    const kaa = ev.kaa_relevant?' kaa':'';
    const isToday = this.isToday(ev.startDate)?' (Today)':'';
    const truncatedDesc = ev.description ? ev.description.slice(0,150)+(ev.description.length>150?'...':'') : '';
    return `<div class="card event-card${kaa}" onclick="app.showEventModal('${ev.title.replace(/'/g,"&apos;")}')">
      <div class="card__body">
        <div class="event-card__header">
          <h3 class="event-card__title">${ev.title}${ev.kaa_relevant?' ⭐':''}</h3>
          <div class="event-meta">
            <div><i class='fas fa-calendar'></i> ${dateStr}${isToday}</div>
            ${ev.time?`<div><i class='fas fa-clock'></i> ${ev.time}</div>`:''}
            ${ev.venue?`<div><i class='fas fa-map-marker-alt'></i> ${ev.venue}</div>`:''}
          </div>
        </div>
        ${truncatedDesc?`<p class="event-description">${truncatedDesc}</p>`:''}
        <div class="event-card__footer">
          <span class="category-badge">${ev.category}</span>
          <span class="event-source">${ev.source}</span>
        </div>
      </div>
    </div>`;
  }

  renderCalendarView(){
    const monthNames=['January','February','March','April','May','June','July','August','September','October','November','December'];
    document.getElementById('calendarTitle').textContent=`${monthNames[this.currentMonth]} ${this.currentYear}`;

    const firstDay = new Date(this.currentYear,this.currentMonth,1);
    const startDate = new Date(firstDay); startDate.setDate(startDate.getDate()-firstDay.getDay());
    const grid=document.getElementById('calendarGrid');
    let html='';
    const dayHeaders=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    dayHeaders.forEach(d=>{html+=`<div class='calendar-cell calendar-header-cell'>${d}</div>`});
    for(let i=0;i<42;i++){
      const cur=new Date(startDate); cur.setDate(startDate.getDate()+i);
      const dayEvents=this.filteredEvents.filter(ev=>this.isSameDay(ev.startDate,cur));
      const other=cur.getMonth()!==this.currentMonth?'other-month':'';
      const todayClass=this.isToday(cur)?'today':'';
      html+=`<div class='calendar-cell ${other} ${todayClass}'>
        <div class='calendar-date'>${cur.getDate()}</div>
        <div class='calendar-events'>
          ${dayEvents.slice(0,3).map(ev=>`<div class='calendar-event ${ev.kaa_relevant?'kaa':''}' onclick=\"app.showEventModal('${ev.title.replace(/'/g,"&apos;")}')\"><span class='calendar-event-dot' style='background:${this.getCategoryColor(ev.category)}'></span>${ev.title}</div>`).join('')}
          ${dayEvents.length>3?`<div class='calendar-more'>+${dayEvents.length-3} more</div>`:''}
        </div>
      </div>`;
    }
    grid.innerHTML=html;
  }

  renderTodayHighlights(){
    const today = new Date(); today.setHours(0,0,0,0);
    const todays = this.events.filter(ev=>ev.startDate.toDateString()===today.toDateString());
    const container=document.getElementById('todayHighlights');
    container.innerHTML = todays.length? todays.map(ev=>`<a href='#' class='today-event-link' onclick="app.showEventModal('${ev.title.replace(/'/g,"&apos;")}');return false;">${ev.kaa_relevant?'⭐ ':''}${ev.title}</a>`).join('') : '<p class="no-events">No events today</p>';
  }

  showEventModal(title){
    const ev=this.events.find(e=>e.title===title);
    if(!ev) return;
    document.getElementById('modalTitle').textContent=ev.title;
    document.getElementById('viewSourceLink').href=ev.url;
    const body=document.getElementById('modalContent');
    body.innerHTML=`<div class='event-details'>
      ${ev.kaa_relevant?`<div class='kaa-badge'>⭐ KAA Relevant Event</div>`:''}
      <div class='detail-row'><strong><i class='fas fa-calendar'></i> Date:</strong><span>${ev.startDate.toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</span></div>
      ${ev.time?`<div class='detail-row'><strong><i class='fas fa-clock'></i> Time:</strong><span>${ev.time}</span></div>`:''}
      ${ev.venue?`<div class='detail-row'><strong><i class='fas fa-map-marker-alt'></i> Venue:</strong><span>${ev.venue}</span></div>`:''}
      ${ev.address?`<div class='detail-row'><strong><i class='fas fa-map'></i> Address:</strong><span>${ev.address}</span></div>`:''}
      <div class='detail-row'><strong><i class='fas fa-tag'></i> Category:</strong><span>${ev.category}</span></div>
      <div class='detail-row'><strong><i class='fas fa-external-link-alt'></i> Source:</strong><span>${ev.source}</span></div>
      ${ev.description?`<div class='detail-row'><strong><i class='fas fa-info-circle'></i> Description:</strong><p>${ev.description}</p></div>`:''}
    </div>`;
    document.getElementById('eventModal').classList.add('active');
  }

  closeModal(){
    document.getElementById('eventModal').classList.remove('active');
  }

  clearFilters(){
    this.filters={search:'',date:'all',category:'all',source:'all',kaaOnly:false};
    document.getElementById('searchInput').value='';
    document.getElementById('dateFilter').value='all';
    document.getElementById('categoryFilter').value='all';
    document.getElementById('sourceFilter').value='all';
    document.getElementById('kaaFilter').checked=false;
    this.applyFilters();
  }

  exportEvents(){
    const blob=new Blob([JSON.stringify(this.filteredEvents,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url; a.download='kokomo-events.json'; a.click();
    URL.revokeObjectURL(url);
  }

  getCategoryColor(cat){
    const colors={arts:'#E64A19',art:'#E64A19',music:'#673AB7',community:'#2196F3',entertainment:'#FF9800',festivals:'#4CAF50','first friday':'#D2BA4C',fundraiser:'#F44336'};
    return colors[cat.toLowerCase()]||'#757575';
  }

  isToday(d){
    const t=new Date(); return d.toDateString()===t.toDateString();
  }
  isSameDay(a,b){return a.toDateString()===b.toDateString();}

  showLoading(){document.getElementById('loadingIndicator').classList.remove('hidden');}
  hideLoading(){document.getElementById('loadingIndicator').classList.add('hidden');}
}

document.addEventListener('DOMContentLoaded',()=>{window.app=new KokomoEventsApp();});