document.addEventListener('DOMContentLoaded', () => {
// Profile
  const initialData = {
    personal: {
      firstName: '',
      lastName: '',
      displayTitle: '',
      gmail: '',
      phone: '',
      location: ''
    },
    about: {
      tagline: '',
      bio: '',
      yearsExp: '',
      studentsTaught: '',
      sessionRate: ''
    },
    subjects: []
  };
  let currentData = JSON.parse(JSON.stringify(initialData));
  const allowedTutorSubjects = [
    'English',
    'Math',
    'Reading',
    'Writing',
    'Filipino',
    'Early Learning Skills',
    'Science',
    'Social Studies',
    'Literacy, Language & Communication',
    'Socio-Emotional Development',
    'Values Development',
    'Physical Health and Motor Development',
    'Aesthetic/Creative Development',
    'Cognitive Development',
    'Language',
    'Reading and Literacy',
    'Mathematics',
    'Makabansa',
    'GMRC',
    'AP',
    'MAPEH',
    'EPP',
    'TLE',
    'ESP'
  ];
// Elements
  // Personal Info
  const fNameInput = document.getElementById('epFirstName');
  const lNameInput = document.getElementById('epLastName');
  const titleInput = document.getElementById('epDisplayTitle');
  const gmailInput = document.getElementById('epGmail');
  const phoneInput = document.getElementById('epPhone');
  const locInput   = document.getElementById('epLocation');
  
  const btnPersonalSave = document.getElementById('epPersonalSave');
  const btnPersonalDiscard = document.getElementById('epPersonalDiscard');

  // About Me
  const taglineInput = document.getElementById('epTagline');
  const bioInput     = document.getElementById('epBio');
  const expInput     = document.getElementById('epYearsExp');
  const taughtInput  = document.getElementById('epStudentsTaught');
  const rateInput    = document.getElementById('epSessionRate');

  const btnAboutSave = document.getElementById('epAboutSave');
  const btnAboutDiscard = document.getElementById('epAboutDiscard');

  // Subjects Taught
  const subjectInput = document.getElementById('epSubjectInput');
  const btnAddSubject = document.getElementById('epAddSubject');
  const btnSubjectsSave = document.getElementById('epSubjectsSave');
  const btnSubjectsDiscard = document.getElementById('epSubjectsDiscard');
  const subjectsList = document.getElementById('epSubjectsList');
  const subjectPicker = document.getElementById('epSubjectPicker');
  const subjectToggle = document.getElementById('epSubjectToggle');
  const subjectMenu = document.getElementById('epSubjectMenu');

  // Misc
  const toast = document.getElementById('epToast');
  const btnViewProfile = document.getElementById('epViewProfile');


// Sidebar Profile Card elements
  const sidebarName = document.querySelector('.profile-card .profile-name');
  const sidebarRole = document.querySelector('.profile-card .profile-role');
// Profile Form
  function populatePersonal() {
    if(!fNameInput) return;
    fNameInput.value = currentData.personal.firstName;
    lNameInput.value = currentData.personal.lastName;
    titleInput.value = currentData.personal.displayTitle;
    gmailInput.value = currentData.personal.gmail;
    phoneInput.value = currentData.personal.phone;
    locInput.value   = currentData.personal.location;
  }

  function populateAbout() {
    if(!taglineInput) return;
    taglineInput.value = currentData.about.tagline;
    bioInput.value     = currentData.about.bio;
    expInput.value     = currentData.about.yearsExp;
    taughtInput.value  = currentData.about.studentsTaught;
    rateInput.value    = currentData.about.sessionRate;
  }

  function renderSubjects() {
    if (!subjectsList) return;
    subjectsList.innerHTML = '';
    currentData.subjects.forEach((subj, index) => {
      const pill = document.createElement('div');
      pill.className = 'ep-subject-pill';
      pill.innerHTML = `
        <span>${subj}</span>
        <span class="ep-subject-delete" data-index="${index}">&times;</span>
      `;
      subjectsList.appendChild(pill);
    });
    document.querySelectorAll('.ep-subject-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const index = parseInt(e.target.getAttribute('data-index'), 10);
        currentData.subjects.splice(index, 1);
        renderSubjects();
      });
    });
    renderSubjectMenu();
  }

  function renderSubjectMenu() {
    if (!subjectMenu) return;
    subjectMenu.innerHTML = '';

    allowedTutorSubjects.forEach(subject => {
      const isSelected = currentData.subjects.some(item => item.toLowerCase() === subject.toLowerCase());
      const option = document.createElement('button');
      option.type = 'button';
      option.className = `ep-subject-option${isSelected ? ' is-selected' : ''}`;
      option.setAttribute('role', 'option');
      option.setAttribute('aria-selected', String(subjectInput?.value === subject));
      option.disabled = isSelected;
      option.textContent = subject;
      option.addEventListener('click', () => {
        if (subjectInput) subjectInput.value = subject;
        closeSubjectMenu();
        subjectInput?.focus();
      });
      subjectMenu.appendChild(option);
    });
  }

  function openSubjectMenu() {
    if (!subjectPicker || !subjectInput || !subjectMenu) return;
    renderSubjectMenu();
    subjectMenu.hidden = false;
    subjectPicker.classList.add('is-open');
    subjectInput.setAttribute('aria-expanded', 'true');
  }

  function closeSubjectMenu() {
    if (!subjectPicker || !subjectInput || !subjectMenu) return;
    subjectMenu.hidden = true;
    subjectPicker.classList.remove('is-open');
    subjectInput.setAttribute('aria-expanded', 'false');
  }

  function toggleSubjectMenu() {
    if (!subjectMenu) return;
    subjectMenu.hidden ? openSubjectMenu() : closeSubjectMenu();
  }
  function normalizeTutorSubject(value) {
    const text = String(value || '').trim();
    return allowedTutorSubjects.find(subject => subject.toLowerCase() === text.toLowerCase()) || '';
  }

  function parseTutorRate(value) {
    const numeric = String(value || '').replace(/[^0-9.]/g, '');
    return Number.parseFloat(numeric) || 0;
  }

  function isValidTutorContact(value) {
    const text = String(value || '').replace(/[\s-]/g, '');
    return /^09\d{9}$/.test(text) || /^\+639\d{9}$/.test(text);
  }

  function validateTutorPayload(payload) {
    const name = String(payload.tutorName || '').trim();
    const education = String(payload.education || '').trim();
    const bio = String(payload.bio || '').trim();
    const subjects = String(payload.subjects || '').split(',').filter(Boolean);
    const rate = parseTutorRate(payload.rate);

    if (name.length < 2 || name.length > 60 || !/[A-Za-z]/.test(name)) {
      return { field: 'epFirstName', message: 'Tutor name must be 2 to 60 characters and contain a letter.' };
    }

    if (education.length < 3 || education.length > 120) {
      return { field: 'epDisplayTitle', message: 'Display title must be 3 to 120 characters.' };
    }

    if (!isValidTutorContact(payload.contactNumber)) {
      return { field: 'epPhone', message: 'Use 09XXXXXXXXX or +639XXXXXXXXX.' };
    }

    if (rate < 1 || rate > 10000) {
      return { field: 'epSessionRate', message: 'Enter a rate from PHP 1 to PHP 10,000 per hour.' };
    }

    if (bio.length < 20 || bio.length > 500) {
      return { field: 'epBio', message: 'Bio must be 20 to 500 characters.' };
    }

    if (subjects.length < 1) {
      return { field: 'epSubjectInput', message: 'Choose at least one valid subject.' };
    }

    if (subjects.some(subject => !normalizeTutorSubject(subject))) {
      return { field: 'epSubjectInput', message: 'Choose subjects from the suggested list.' };
    }

    return null;
  }
// Profile Data
  fetch('/Home/Me')
    .then(r => r.ok ? r.json() : null)
    .then(async user => {
        if (!user) return;
        const listRes = await fetch('/Tutor/List');
        if (!listRes.ok) return;
        const tutors = await listRes.json();
        const t = tutors.find(x => x.tutorName === user.name) || tutors[0];
        if (!t) return;

        const detailRes = await fetch(`/Tutor/GetProfile?id=${t.id}`);
        if (!detailRes.ok) return;
        const profile = await detailRes.json();

        const nameParts = (profile.tutorName || '').split(' ');
        currentData.personal.firstName = nameParts[0] || '';
        currentData.personal.lastName = nameParts.slice(1).join(' ') || '';
        currentData.personal.displayTitle = profile.education || '';
        currentData.personal.gmail = profile.email || '';
        currentData.personal.phone = profile.contactNumber || '';
        currentData.about.bio = profile.bio || '';
        currentData.about.sessionRate = profile.rate || '';
        currentData.subjects = profile.subjects
            ? profile.subjects.split(',').map(s => s.trim()).filter(Boolean)
            : [];

        populatePersonal();
        populateAbout();
        renderSubjects();
        setProfileAvatar(profile.tutorName, profile.profilePhoto);
    });
// Notifications
  function showToast(message, type = 'success') {
    if (!toast) return;
    toast.textContent = message;
    toast.className = 'ep-toast show';
    if (type === 'success') toast.classList.add('ep-toast-success');
    if (type === 'info')    toast.classList.add('ep-toast-info');

    setTimeout(() => {
      toast.classList.remove('show');
    }, 2500);
  }
// Buttons
  if (btnPersonalSave) {
    btnPersonalSave.addEventListener('click', async () => {
        currentData.personal.firstName = fNameInput.value;
        currentData.personal.lastName  = lNameInput.value;
        currentData.personal.displayTitle = titleInput.value;
        currentData.personal.gmail     = gmailInput.value || currentData.personal.gmail;
        currentData.personal.phone     = phoneInput.value;
        currentData.personal.location  = locInput.value;

        if (!await saveToDatabase()) return;

        if (sidebarName) sidebarName.textContent = `${currentData.personal.firstName} ${currentData.personal.lastName}`;
        if (sidebarRole) sidebarRole.textContent = currentData.personal.displayTitle;
        showToast('Personal information saved!', 'success');
    });
  }

  if (btnPersonalDiscard) {
    btnPersonalDiscard.addEventListener('click', () => {
      populatePersonal();
      showToast('Changes discarded', 'info');
    });
  }

  if (btnAboutSave) {
    btnAboutSave.addEventListener('click', async () => {
        currentData.about.tagline = taglineInput.value;
        currentData.about.bio     = bioInput.value;
        currentData.about.yearsExp = expInput.value;
        currentData.about.studentsTaught = taughtInput.value;
        currentData.about.sessionRate = rateInput.value;

        if (!await saveToDatabase()) return;
        showToast('About Me saved!', 'success');
    });
  }

  if (btnAboutDiscard) {
    btnAboutDiscard.addEventListener('click', () => {
      populateAbout();
      showToast('Changes discarded', 'info');
    });
  }

  if (btnAddSubject) {
    btnAddSubject.addEventListener('click', () => {
      const val = normalizeTutorSubject(subjectInput.value);
      if (!val) {
        showToast('Please choose a subject', 'info');
        return;
      }

      if (currentData.subjects.some(subject => subject.toLowerCase() === val.toLowerCase())) {
        showToast('That subject is already listed.', 'info');
        return;
      }

      currentData.subjects.push(val);
      renderSubjects();
      showToast(`Added subject: ${val}`, 'success');
      subjectInput.value = "";
    });
  }

  if (subjectInput) {
    subjectInput.addEventListener('click', openSubjectMenu);
    subjectInput.addEventListener('focus', openSubjectMenu);
    subjectInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        btnAddSubject.click();
      } else if (e.key === 'Escape') {
        closeSubjectMenu();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        openSubjectMenu();
        subjectMenu?.querySelector('.ep-subject-option:not(:disabled)')?.focus();
      }
    });
  }

  if (subjectToggle) {
    subjectToggle.addEventListener('click', toggleSubjectMenu);
  }

  if (subjectMenu) {
    subjectMenu.addEventListener('keydown', (e) => {
      const options = [...subjectMenu.querySelectorAll('.ep-subject-option:not(:disabled)')];
      const currentIndex = options.indexOf(document.activeElement);

      if (e.key === 'Escape') {
        closeSubjectMenu();
        subjectInput?.focus();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        options[Math.min(currentIndex + 1, options.length - 1)]?.focus();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        options[Math.max(currentIndex - 1, 0)]?.focus();
      }
    });
  }

  document.addEventListener('click', (e) => {
    if (!subjectPicker || subjectPicker.contains(e.target)) return;
    closeSubjectMenu();
  });

  if (btnSubjectsSave) {
    btnSubjectsSave.addEventListener('click', async () => {
        if (!await saveToDatabase()) return;
        initialData.subjects = JSON.parse(JSON.stringify(currentData.subjects));
        showToast('Subjects saved!', 'success');
    });
  }
  
  if (btnSubjectsDiscard) {
    btnSubjectsDiscard.addEventListener('click', () => {
      currentData.subjects = JSON.parse(JSON.stringify(initialData.subjects));
      renderSubjects();
      subjectInput.value = "";
      showToast('Changes discarded', 'info');
    });
  }

  if (btnViewProfile) {
    btnViewProfile.addEventListener('click', () => {
      showToast('Public profile preview coming soon!', 'info');
    });
  }
// Save Profile
  async function saveToDatabase() {
      const meRes = await fetch('/Home/Me');
      if (!meRes.ok) return false;
      const user = await meRes.json();

      const payload = {
          email: String(user.email || currentData.personal.gmail || '').trim(),
          tutorName: `${currentData.personal.firstName} ${currentData.personal.lastName}`.trim(),
          rate: String(currentData.about.sessionRate || '').trim(),
          education: String(currentData.personal.displayTitle || '').trim(),
          contactNumber: String(currentData.personal.phone || '').trim(),
          bio: String(currentData.about.bio || '').trim(),
          subjects: currentData.subjects.map(normalizeTutorSubject).filter(Boolean).join(',')
      };

      const validation = validateTutorPayload(payload);
      if (validation) {
        showToast(validation.message, 'info');
        document.getElementById(validation.field)?.focus();
        return false;
      }

      const response = await fetch('/Home/SaveTutorProfile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        showToast(result.message || 'Could not save profile changes.', 'info');
        if (result.field) document.getElementById(result.field)?.focus();
        return false;
      }

      currentData.subjects = payload.subjects.split(',').filter(Boolean);
      renderSubjects();
      return true;
  }
// Profile Photo
  const btnUpload = document.getElementById('epUploadBtn');
  const fileInput = document.getElementById('epFileInput');
  const avatar    = document.getElementById('epAvatar');
  const btnRemovePhoto = document.getElementById('epRemovePhotoBtn');


  function setProfileAvatar(name, photoUrl) {
    if (!avatar) return;

    const initials = String(name || 'Tutor')
      .split(/\s+/)
      .filter(Boolean)
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);

    avatar.innerHTML = '';
    avatar.style.backgroundImage = '';
    avatar.textContent = initials || 'T';

    if (photoUrl) {
      avatar.textContent = '';
      avatar.style.backgroundImage = `url(${photoUrl})`;
      avatar.style.backgroundSize = 'cover';
      avatar.style.backgroundPosition = 'center';
    }
  }

  if (btnUpload && fileInput) {
    btnUpload.addEventListener('click', () => {
      fileInput.click();
    });

    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
          setProfileAvatar(`${currentData.personal.firstName} ${currentData.personal.lastName}`, ev.target.result);
      };
      reader.readAsDataURL(file);
      const formData = new FormData();
      formData.append('photo', file);
      const res = await fetch('/Home/UploadTutorPhoto', { method: 'POST', body: formData });
      if (res.ok) {
          const result = await res.json();
          window.dispatchEvent(new CustomEvent('tutor:profile-photo-updated', {
            detail: { photoUrl: result.photoUrl }
          }));
          showToast('Profile photo saved!', 'success');
      } else {
          showToast('Upload failed', 'error');
      }
    });
  }

  if (btnRemovePhoto) {
    btnRemovePhoto.addEventListener('click', async () => {
      const confirmed = await SkolarDialog.confirm(
        'Remove your current profile photo and use your initials instead?',
        {
          title: 'Remove profile photo?',
          type: 'danger',
          confirmText: 'Remove Photo'
        }
      );

      if (!confirmed) return;

      btnRemovePhoto.disabled = true;
      btnRemovePhoto.textContent = 'Removing...';

      try {
        const response = await fetch('/Home/RemoveTutorPhoto', { method: 'POST' });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.message || 'Could not remove the profile photo.');

        const name = `${currentData.personal.firstName} ${currentData.personal.lastName}`.trim();
        setProfileAvatar(name, '');
        fileInput.value = '';
        window.dispatchEvent(new CustomEvent('tutor:profile-photo-updated', {
          detail: { photoUrl: '' }
        }));
        showToast(result.message || 'Profile photo removed.', 'success');
      } catch (error) {
        showToast(error.message, 'info');
      } finally {
        btnRemovePhoto.disabled = false;
        btnRemovePhoto.textContent = 'Remove Photo';
      }
    });
  }

// Sidebar
  const sidebar = document.getElementById('sidebar');
  const hamburger = document.getElementById('hamburger');
  const sidebarOverlay = document.getElementById('sidebarOverlay');

  function closeSidebar() {
    if (!sidebar) return;
    sidebar.classList.remove('open');
    if (sidebarOverlay) sidebarOverlay.classList.remove('show');
  }

  if (hamburger) {
    hamburger.addEventListener('click', () => {
      sidebar.classList.toggle('open');
      if (sidebarOverlay) sidebarOverlay.classList.toggle('show');
    });
  }
  if (sidebarOverlay) {
    sidebarOverlay.addEventListener('click', closeSidebar);
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeSidebar();
    }
  });

});
