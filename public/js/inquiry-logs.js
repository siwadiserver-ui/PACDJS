window.InquiryLogsModule = {
  init: function () {
    const btnRefresh = document.getElementById('btnRefreshInquiries');
    
    if (btnRefresh) {
      btnRefresh.addEventListener('click', () => this.loadInquiries());
    }
    
    // Auto-load kapag na-click ang tab
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
      if (item.textContent.includes('Inquiry Logs')) {
        item.addEventListener('click', () => {
          setTimeout(() => this.loadInquiries(), 100);
        });
      }
    });

    // Event delegation para sa delete buttons
    const tableBody = document.getElementById('inquiryTableBody');
    if (tableBody) {
      tableBody.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-delete-inquiry');
        if (btn) {
          const id = btn.getAttribute('data-id');
          const accountNo = btn.getAttribute('data-account');
          const name = btn.getAttribute('data-name');
          this.deleteInquiry(id, accountNo, name);
        }
      });
    }
  },

  loadInquiries: async function () {
    const tableBody = document.getElementById('inquiryTableBody');
    const summaryText = document.getElementById('inquirySummaryText');
    const statsContainer = document.getElementById('inquiryStats');
    
    tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px;">⏳ Naglo-load...</td></tr>';
    
    try {
      const [inquiriesRes, statsRes] = await Promise.all([
        fetch('/api/inquiries?limit=500'),
        fetch('/api/inquiries/stats')
      ]);
      
      const inquiriesData = await inquiriesRes.json();
      const statsData = await statsRes.json();
      
      // Render stats
      if (statsData.success) {
        const s = statsData.stats;
        statsContainer.innerHTML = `
          <div style="background:var(--card-bg); padding:18px; border-radius:14px; border:1.5px solid var(--card-border); box-shadow:var(--card-shadow);">
            <div style="font-size:0.72rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.08em; font-weight:800;">Total</div>
            <div style="font-size:1.8rem; font-weight:800; color:var(--primary); margin-top:4px;">${s.total.toLocaleString()}</div>
          </div>
          <div style="background:var(--card-bg); padding:18px; border-radius:14px; border:1.5px solid var(--card-border); box-shadow:var(--card-shadow);">
            <div style="font-size:0.72rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.08em; font-weight:800;">Ngayong Araw</div>
            <div style="font-size:1.8rem; font-weight:800; color:var(--primary-dark); margin-top:4px;">${s.today.toLocaleString()}</div>
          </div>
          <div style="background:var(--card-bg); padding:18px; border-radius:14px; border:1.5px solid var(--card-border); box-shadow:var(--card-shadow);">
            <div style="font-size:0.72rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.08em; font-weight:800;">Last 7 Days</div>
            <div style="font-size:1.8rem; font-weight:800; color:var(--primary-light); margin-top:4px;">${s.lastWeek.toLocaleString()}</div>
          </div>
        `;
      }
      
      // Render table
      if (!inquiriesData.success || !inquiriesData.inquiries || inquiriesData.inquiries.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px; color:var(--sp-subtext);">Walang inquiries na nakita.</td></tr>';
        summaryText.textContent = '';
        return;
      }
      
      summaryText.textContent = `📊 ${inquiriesData.count} inquiries (pinakabago muna)`;
      
      tableBody.innerHTML = inquiriesData.inquiries.map((inq, idx) => {
        const date = new Date(inq.inquiry_at);
        const formattedDate = date.toLocaleString('en-PH', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true
        });
        
        const safeAccount = (inq.account_no || '').replace(/'/g, "\\'");
        const safeName = (inq.name || '').replace(/'/g, "\\'");
        
        return `
          <tr>
            <td style="color:var(--sp-subtext);">${idx + 1}</td>
            <td><strong>${inq.account_no || '-'}</strong></td>
            <td>${inq.name || '-'}</td>
            <td style="color:var(--sp-subtext); font-size:0.8rem;">${formattedDate}</td>
            <td style="text-align:center;">
              <button class="btn-delete-inquiry" 
                      data-id="${inq.id}" 
                      data-account="${safeAccount}" 
                      data-name="${safeName}"
                      style="background:#dc2626; color:white; border:none; border-radius:6px; padding:6px 12px; font-size:0.75rem; font-weight:700; cursor:pointer; transition: background 0.2s;"
                      onmouseover="this.style.background='#b91c1c'"
                      onmouseout="this.style.background='#dc2626'">
                🗑️ Delete
              </button>
            </td>
          </tr>
        `;
      }).join('');
      
    } catch (err) {
      tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:20px; color:#f87171;">❌ Error: ${err.message}</td></tr>`;
    }
  },

  deleteInquiry: async function (id, accountNo, name) {
    const confirmMsg = `Sigurado ka bang gusto mong i-delete ang inquiry na ito?\n\nAccount: ${accountNo}\nName: ${name}\nID: ${id}\n\nHindi na ito maibabalik.`;
    
    if (!confirm(confirmMsg)) return;
    
    try {
      const res = await fetch(`/api/inquiries/${id}`, {
        method: 'DELETE'
      });
      
      const result = await res.json();
      
      if (result.success) {
        this.loadInquiries();
      } else {
        alert('❌ Hindi na-delete: ' + (result.error || 'Unknown error'));
      }
    } catch (err) {
      alert('❌ Connection error: ' + err.message);
    }
  }
};