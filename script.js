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
};

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

    const now = new Date().toISOString();
    const application = {
        id: crypto.randomUUID(),
        company: addFields.company.value.trim(),
        jobUrl: addFields.jobUrl.value.trim(),
        location: addFields.location.value.trim(),
        salary: Number(addFields.salary.value),
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

    if (index === -1) {
        closeDialog();
        return;
    }

    applications[index] = {
        ...applications[index],
        company: editFields.company.value.trim(),
        jobUrl: editFields.jobUrl.value.trim(),
        salary: Number(editFields.salary.value),
        status: editFields.status.value,
        updatedAt: new Date().toISOString(),
    };

    persistAndRender();
    closeDialog();
});

closeDialogButton.addEventListener('click', closeDialog);
cancelEditButton.addEventListener('click', closeDialog);

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
            .map((application) => ({
                id: String(application.id || crypto.randomUUID()),
                company: String(application.company || ''),
                jobUrl: String(application.jobUrl || ''),
                location: String(application.location || ''),
                salary: Number(application.salary || 0),
                status: normalizeStatus(application.status),
                createdAt: application.createdAt || new Date().toISOString(),
                updatedAt: application.updatedAt || application.createdAt || new Date().toISOString(),
            }))
            .filter((application) => application.company && application.jobUrl && application.salary > 0)
            .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt));
    } catch {
        return [];
    }
}

function persistAndRender() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(applications));
    render();
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
            return `
        <article class="card" style="--tone: ${trafficLight.color};">
          <div class="card-top">
            <div>
              <p class="company-name">${escapeHtml(application.company)}</p>
              <a class="card-link" href="${escapeAttribute(application.jobUrl)}" target="_blank" rel="noreferrer">Stellenlink öffnen</a>
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
              <strong>${euroFormatter.format(application.salary)}</strong>
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
    editFields.salary.value = application.salary;
    editFields.status.value = application.status;

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

function formatDate(value) {
    return dateFormatter.format(new Date(value));
}

function normalizeStatus(status) {
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