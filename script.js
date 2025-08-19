const firebaseConfig = {
    // IMPORTANT: replace with your actual firebase config
    databaseURL: "https://doorprize-katar-06-default-rtdb.asia-southeast1.firebasedatabase.app/"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// --- CRITICAL SECURITY WARNING ---
// The admin password is saved directly in the code.
// Anyone can see it by viewing the page source.
// This is NOT secure and should ONLY be used for a private, non-critical event.
// For a real application, use Firebase Authentication.
const adminPass = '123'; 

function showMessage(text, isError = false) {
    const msgEl = document.getElementById('messages');
    msgEl.textContent = text;
    msgEl.style.color = isError ? 'red' : 'green';
    setTimeout(() => { msgEl.textContent = ''; }, 4000);
}

function registerUser() {
    const name = document.getElementById('name').value.trim();
    let rt = document.getElementById('rt').value.trim();
    if (!name || !rt) {
        showMessage('Please fill in all fields.', true);
        return;
    }
    rt = parseInt(rt, 10);

    const uniqueKey = name.toLowerCase() + '-' + rt;

    db.ref('users').orderByChild('unique').equalTo(uniqueKey).once('value', snapshot => {
        if (snapshot.exists()) {
            showMessage(`Name ${name} from RT ${rt} is already registered!`, true);
        } else {
            const newRef = db.ref('users').push();
            newRef.set({ name, rt, unique: uniqueKey, key: newRef.key }).then(() => {
                showMessage(`Successfully registered ${name} (RT ${rt}). Thank you!`);
                document.getElementById('name').value = '';
                document.getElementById('rt').value = '';
            }).catch(err => {
                showMessage(`Error: ${err.message}`, true);
            });
        }
    });
}

function loginAdmin() {
    const pass = document.getElementById('adminPassword').value;
    if (pass === adminPass) {
        document.getElementById('admin-section').style.display = 'block';
        document.querySelector('h2:nth-of-type(1)').style.display = 'none';
        document.getElementById('adminPassword').style.display = 'none';
        document.querySelector('button[onclick="loginAdmin()"]').style.display = 'none';
        listenToData();
    } else {
        alert('Wrong password');
    }
}

function listenToData() {
    db.ref('users').on('value', snapshot => {
        const tbody = document.querySelector('#userTable tbody');
        tbody.innerHTML = '';
        const users = snapshot.val() || {};
        const userCount = Object.keys(users).length;
        document.getElementById('user-count').textContent = userCount;
        
        snapshot.forEach(child => {
            const u = child.val();
            const key = child.key;
            const row = document.createElement('tr');
            row.innerHTML = `<td>${u.name}</td><td>${u.rt}</td>
                             <td><button class='admin-btn' onclick='deleteUser("${key}", "${u.name}")'>Delete</button></td>`;
            tbody.appendChild(row);
        });
        updateEligibleCount();
    });

    db.ref('winners').on('value', snapshot => {
        const winnerList = document.getElementById('winner-list');
        winnerList.innerHTML = '';
        snapshot.forEach(child => {
            const winner = child.val();
            const li = document.createElement('li');
            li.textContent = `${winner.name} (RT ${winner.rt})`;
            winnerList.appendChild(li);
        });
        updateEligibleCount();
    });
}

function deleteUser(key, name) {
    if (confirm(`Are you sure you want to delete ${name}?`)) {
        db.ref('winners').orderByChild('key').equalTo(key).once('value', snapshot => {
            snapshot.forEach(child => {
                db.ref('winners/' + child.key).remove();
            });
        });
        db.ref('users/' + key).remove();
        showMessage(`${name} has been deleted.`, false);
    }
}

function resetAll() {
    if (confirm('DANGER! This will delete ALL registered users and ALL winners. Are you sure?')) {
        db.ref('users').remove();
        db.ref('winners').remove();
        document.getElementById('winner').textContent = '';
        showMessage('All data has been reset.', false);
    }
}

function exportToCSV() {
    db.ref('users').once('value', snapshot => {
        if (!snapshot.exists()) {
            alert('No users to export.');
            return;
        }

        // Changed the header to include 'No.' and 'Nama'
        let csvContent = 'No.,Nama,RT Number\n';
        let counter = 1; // Start a counter for the row number

        snapshot.forEach(child => {
            const u = child.val();
            // Added the counter to the beginning of each row
            csvContent += `${counter},"${u.name.replace(/"/g, '""')}",${u.rt}\n`;
            counter++; // Increment the counter for the next row
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'doorprize_users.csv';
        a.click();
    });
}

async function updateEligibleCount() {
    const usersSnapshot = await db.ref('users').get();
    const winnersSnapshot = await db.ref('winners').get();
    const users = usersSnapshot.val() || {};
    const winners = winnersSnapshot.val() || {};

    const winnerKeys = new Set(Object.values(winners).map(w => w.key));
    const eligibleCount = Object.keys(users).filter(key => !winnerKeys.has(key)).length;
    
    document.getElementById('eligible-count').textContent = eligibleCount;
}

async function spinWheel() {
    const winnerEl = document.getElementById('winner');
    winnerEl.textContent = 'Spinning...';

    const usersSnapshot = await db.ref('users').get();
    const winnersSnapshot = await db.ref('winners').get();
    const users = usersSnapshot.val() || {};
    const winners = winnersSnapshot.val() || {};
    
    const winnerKeys = new Set(Object.values(winners).map(w => w.key));
    const eligibleUsers = Object.values(users).filter(user => !winnerKeys.has(user.key));

    if (eligibleUsers.length === 0) {
        winnerEl.textContent = 'No eligible users left to draw!';
        return;
    }

    const winnerIndex = Math.floor(Math.random() * eligibleUsers.length);
    const winner = eligibleUsers[winnerIndex];

    setTimeout(() => {
        winnerEl.textContent = `🎉 Winner: ${winner.name} (RT ${winner.rt}) 🎉`;
        db.ref('winners').push(winner);
    }, 1500);
}

function resetWinners() {
    if (confirm('Are you sure you want to clear the winners list and make everyone eligible again?')) {
        db.ref('winners').remove();
        document.getElementById('winner').textContent = '';
        showMessage('Winners list has been reset.', false);
    }
}
