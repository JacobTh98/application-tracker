const STORAGE_KEY = 'application-tracker:v1';
const MS_PER_DAY = 1000 * 60 * 60 * 24;
const INACTIVITY_LIMIT_DAYS = 14;

const applicationForm = document.getElementById('application-form');
const listElement = document.getElementById('application-list');
const statsElement = document.getElementById('stats');
const editDialog = document.getElementById('edit-dialog');
const editForm = document.getElementById('edit-form');
const closeDialogButton = document.getElementById('close-dialog');
const cancelEditButton = document.getElementById('cancel-edit');
const exportCsvButton = document.getElementById('export-csv');

const addFields = {
    company: document.getElementById('company'),
    jobUrl: document.getElementById('jobUrl'),
    location: document.getElementById('location'),
    salary: document.getElementById('salary'),
};

const editFields = {
    id: document.getElementById('edit-id'),
    company: document.getElementById('edit-company'),
    jobUrl: document.getElementById('edit-jobUrl'),
    location: document.getElementById('edit-location'),
    salary: document.getElementById('edit-salary'),
    status: document.getElementById('edit-status'),
    interviewDate: document.getElementById('edit-interview-date'),
    interviewTime: document.getElementById('edit-interview-time'),
    interviewAddress: document.getElementById('edit-interview-address'),
};
const interviewFields = document.getElementById('interview-fields');

const euroFormatter = new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat('de-DE', {
    dateStyle: 'medium',
});

let applications = loadApplications();

render();

applicationForm.addEventListener('submit', (event) => {
    event.preventDefault();

    const rawSalary = addFields.salary.value.trim();
    const now = new Date().toISOString();
    const application = {
        id: crypto.randomUUID(),
        company: addFields.company.value.trim(),
        jobUrl: addFields.jobUrl.value.trim(),
        location: addFields.location.value.trim(),
        salary: rawSalary ? Number(rawSalary) : null,
        status: 'offen',
        createdAt: now,
        updatedAt: now,
    };

    applications = [application, ...applications];
    persistAndRender();
    applicationForm.reset();
    addFields.company.focus();
});

editForm.addEventListener('submit', (event) => {
    event.preventDefault();

    const id = editFields.id.value;
    const index = applications.findIndex((application) => application.id === id);
    const rawSalary = editFields.salary.value.trim();

    if (index === -1) {
        closeDialog();
        return;
    }

    applications[index] = {
        ...applications[index],
        company: editFields.company.value.trim(),
        jobUrl: editFields.jobUrl.value.trim(),
        location: editFields.location.value.trim(),
        salary: rawSalary ? Number(rawSalary) : null,
        status: editFields.status.value,
        interviewDate: editFields.status.value === 'bewerbungsgespraech' ? editFields.interviewDate.value : '',
        interviewTime: editFields.status.value === 'bewerbungsgespraech' ? editFields.interviewTime.value : '',
        interviewAddress: editFields.status.value === 'bewerbungsgespraech' ? editFields.interviewAddress.value.trim() : '',
        updatedAt: new Date().toISOString(),
    };

    persistAndRender();
    closeDialog();
});

closeDialogButton.addEventListener('click', closeDialog);
cancelEditButton.addEventListener('click', closeDialog);
exportCsvButton.addEventListener('click', exportApplicationsToCsv);
editFields.status.addEventListener('change', updateInterviewFields);

function loadApplications() {
    const rawData = localStorage.getItem(STORAGE_KEY);

    if (!rawData) {
        return [];
    }

    try {
        const parsed = JSON.parse(rawData);
        if (!Array.isArray(parsed)) {
            return [];
        }

        return parsed
            .filter((application) => application && typeof application === 'object')
            .map((application) => {
                const parsedSalary = Number(application.salary);
                return {
                    id: String(application.id || crypto.randomUUID()),
                    company: String(application.company || ''),
                    jobUrl: String(application.jobUrl || ''),
                    location: String(application.location || ''),
                    salary: Number.isFinite(parsedSalary) && parsedSalary > 0 ? parsedSalary : null,
                    status: normalizeStatus(application.status),
                    interviewDate: String(application.interviewDate || ''),
                    interviewTime: String(application.interviewTime || ''),
                    interviewAddress: String(application.interviewAddress || ''),
                    createdAt: application.createdAt || new Date().toISOString(),
                    updatedAt: application.updatedAt || application.createdAt || new Date().toISOString(),
                };
            })
            .filter((application) => application.company && application.jobUrl)
            .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt));
    } catch {
        return [];
    }
}

function persistAndRender() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(applications));
    render();
}

function exportApplicationsToCsv() {
    const csvRows = [
        ['Firma', 'Link', 'Ort', 'Gefordertes Einstiegsgehalt', 'Status', 'Gesprächsdatum', 'Gesprächsuhrzeit', 'Gesprächsadresse', 'Erstellt am', 'Zuletzt aktualisiert'],
        ...applications.map((application) => [
            application.company,
            application.jobUrl,
            application.location || 'Nicht angegeben',
            application.salary !== null && application.salary > 0 ? String(application.salary) : 'nicht angegeben',
            application.status,
            application.interviewDate || '',
            application.interviewTime || '',
            application.interviewAddress || '',
            application.createdAt,
            application.updatedAt,
        ]),
    ];

    const csvContent = csvRows
        .map((row) => row.map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(';'))
        .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'bewerbungen.csv';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
}

function render() {
    renderStats();
    renderList();
}

function renderStats() {
    const openCount = applications.filter((application) => getTrafficLight(application).tone === 'green').length;
    const staleCount = applications.filter((application) => getTrafficLight(application).tone === 'yellow').length;
    const rejectedCount = applications.filter((application) => application.status === 'abgelehnt').length;
    const totalCount = applications.length;

    statsElement.innerHTML = `
    <article class="metric">
      <span class="metric-label">Gesamt</span>
      <span class="metric-value">${totalCount}</span>
    </article>
    <article class="metric">
      <span class="metric-label">Offen</span>
      <span class="metric-value">${openCount}</span>
    </article>
    <article class="metric">
      <span class="metric-label">Gelb</span>
      <span class="metric-value">${staleCount}</span>
    </article>
    <article class="metric">
      <span class="metric-label">Abgelehnt</span>
      <span class="metric-value">${rejectedCount}</span>
    </article>
  `;
}

function renderList() {
    if (!applications.length) {
        listElement.innerHTML = `
      <div class="empty-state">
        Noch keine Bewerbungen vorhanden. Füge oben den ersten Eintrag hinzu, dann erscheint er direkt in der Übersicht.
      </div>
    `;
        return;
    }

    listElement.innerHTML = applications
        .map((application) => {
            const trafficLight = getTrafficLight(application);
            const interviewDetails = renderInterviewDetails(application);
            return `
        <article class="card" style="--tone: ${trafficLight.color};">
          <div class="card-top">
            <div>
              <p class="company-name">${escapeHtml(application.company)}</p>
              <a class="card-link" href="${escapeAttribute(application.jobUrl)}" target="_blank" rel="noreferrer">Stellenlink</a>
            </div>
            <div class="status-pill" aria-label="Status ${escapeAttribute(trafficLight.label)}">
              <span class="status-dot" aria-hidden="true"></span>
              <span>${escapeHtml(trafficLight.label)}</span>
            </div>
          </div>

          <div class="meta-grid">
            <div class="meta-item">
                                    <span>Ort</span>
                                    <strong>${escapeHtml(application.location || 'Nicht angegeben')}</strong>
                                </div>
                                <div class="meta-item">
              <span>Einstiegsgehalt</span>
              <strong>${application.salary !== null && application.salary > 0 ? euroFormatter.format(application.salary) : 'nicht angegeben'}</strong>
            </div>
            <div class="meta-item">
              <span>Hinzugefügt am</span>
              <strong>${formatDate(application.createdAt)}</strong>
            </div>
            <div class="meta-item">
              <span>Zuletzt aktualisiert</span>
              <strong>${formatDate(application.updatedAt)}</strong>
            </div>
            <div class="meta-item">
              <span>Hinweis</span>
              <strong>${escapeHtml(trafficLight.note)}</strong>
            </div>
            ${interviewDetails}
          </div>

          <div class="card-actions">
            <button type="button" class="ghost-button" data-action="edit" data-id="${escapeAttribute(application.id)}">Bearbeiten</button>
            <button type="button" class="ghost-button" data-action="delete" data-id="${escapeAttribute(application.id)}">Löschen</button>
          </div>
        </article>
      `;
        })
        .join('');

    listElement.querySelectorAll('[data-action="edit"]').forEach((button) => {
        button.addEventListener('click', () => {
            const application = applications.find((item) => item.id === button.dataset.id);
            if (application) {
                openEditDialog(application);
            }
        });
    });

    listElement.querySelectorAll('[data-action="delete"]').forEach((button) => {
        button.addEventListener('click', () => {
            const application = applications.find((item) => item.id === button.dataset.id);
            if (!application) {
                return;
            }

            const confirmed = window.confirm(`Bewerbung bei ${application.company} wirklich löschen?`);
            if (!confirmed) {
                return;
            }

            applications = applications.filter((item) => item.id !== application.id);
            persistAndRender();
        });
    });
}

function openEditDialog(application) {
    editFields.id.value = application.id;
    editFields.company.value = application.company;
    editFields.jobUrl.value = application.jobUrl;
    editFields.location.value = application.location || '';
    editFields.salary.value = application.salary !== null && application.salary > 0 ? application.salary : '';
    editFields.status.value = application.status;
    editFields.interviewDate.value = application.interviewDate || '';
    editFields.interviewTime.value = application.interviewTime || '';
    editFields.interviewAddress.value = application.interviewAddress || '';
    updateInterviewFields();

    if (typeof editDialog.showModal === 'function') {
        editDialog.showModal();
    } else {
        editDialog.setAttribute('open', '');
    }

    editFields.company.focus();
}

function closeDialog() {
    if (editDialog.open) {
        editDialog.close();
    }
}

function updateInterviewFields() {
    const hasInterview = editFields.status.value === 'bewerbungsgespraech';
    interviewFields.hidden = !hasInterview;
    editFields.interviewDate.required = hasInterview;
    editFields.interviewTime.required = hasInterview;
    editFields.interviewAddress.required = hasInterview;
}

function renderInterviewDetails(application) {
    if (application.status !== 'bewerbungsgespraech') {
        return '';
    }

    return `
      <div class="meta-item interview-meta">
        <span>Bewerbungsgespräch</span>
        <strong>${escapeHtml(formatInterviewDate(application.interviewDate))}${application.interviewTime ? ` um ${escapeHtml(application.interviewTime)} Uhr` : ''}</strong>
        <small>${escapeHtml(application.interviewAddress || 'Adresse nicht angegeben')}</small>
      </div>
    `;
}

function formatInterviewDate(value) {
    if (!value) {
        return 'Datum nicht angegeben';
    }

    const [year, month, day] = value.split('-').map(Number);
    return dateFormatter.format(new Date(year, month - 1, day));
}

function formatDate(value) {
    return dateFormatter.format(new Date(value));
}

function normalizeStatus(status) {
    if (status === 'bewerbungsgespraech') {
        return 'bewerbungsgespraech';
    }

    if (status === 'abgelehnt') {
        return 'abgelehnt';
    }

    if (status === 'wartend') {
        return 'wartend';
    }

    return 'offen';
}

function getTrafficLight(application) {
    if (application.status === 'abgelehnt') {
        return {
            tone: 'red',
            color: 'var(--red)',
            label: 'Abgelehnt',
            note: 'Nicht weiter verfolgen',
        };
    }

    if (application.status === 'bewerbungsgespraech') {
        return {
            tone: 'interview',
            color: 'var(--interview)',
            label: 'Bewerbungsgespräch',
            note: 'Gespräch vereinbart',
        };
    }

    const daysWithoutActivity = (Date.now() - new Date(application.updatedAt).getTime()) / MS_PER_DAY;
    if (daysWithoutActivity >= INACTIVITY_LIMIT_DAYS) {
        return {
            tone: 'yellow',
            color: 'var(--yellow)',
            label: 'Wartet zu lange',
            note: `${Math.floor(daysWithoutActivity)} Tage ohne Update`,
        };
    }

    return {
        tone: 'green',
        color: 'var(--green)',
        label: application.status === 'wartend' ? 'Wartend' : 'Offen',
        note: 'Aktuell in Bearbeitung',
    };
}

function escapeHtml(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function escapeAttribute(value) {
    return escapeHtml(value).replaceAll('`', '&#96;');
}
