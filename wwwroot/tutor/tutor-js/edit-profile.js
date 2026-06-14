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
  }  // ← renderSubjects ends here (CORRECT)
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
        currentData.personal.gmail     = gmailInput.value;
        currentData.personal.phone     = phoneInput.value;
        currentData.personal.location  = locInput.value;

        if (sidebarName) sidebarName.textContent = `${currentData.personal.firstName} ${currentData.personal.lastName}`;
        if (sidebarRole) sidebarRole.textContent = currentData.personal.displayTitle;

        await saveToDatabase();
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

        await saveToDatabase();
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
      const val = subjectInput.value.trim();
      if (val !== "") {
        currentData.subjects.push(val);
        renderSubjects();
        showToast(`Added subject: ${val}`, 'success');
        subjectInput.value = "";
      } else {
        showToast('Please enter a subject', 'info');
      }
    });
  }

  if (subjectInput) {
    subjectInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        btnAddSubject.click();
      }
    });
  }

  if (btnSubjectsSave) {
    btnSubjectsSave.addEventListener('click', async () => {
        initialData.subjects = JSON.parse(JSON.stringify(currentData.subjects));
        await saveToDatabase();
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
      if (!meRes.ok) return;
      const user = await meRes.json();

      const payload = {
          email: user.email,
          tutorName: `${currentData.personal.firstName} ${currentData.personal.lastName}`,
          rate: currentData.about.sessionRate,
          education: currentData.personal.displayTitle,
          contactNumber: currentData.personal.phone,
          bio: currentData.about.bio,
          subjects: currentData.subjects.join(',')
      };

      await fetch('/Home/SaveTutorProfile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
      });
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
