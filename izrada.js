// Firebase konfiguracija
const firebaseConfig = {
    apiKey: "AIzaSyCJMWYFiXFXLFqyE4TwADwdLgNfTIHuXUg",
    authDomain: "silver-fa4e9.firebaseapp.com",
    databaseURL: "https://silver-fa4e9-default-rtdb.europe-west1.firebasedatabase.app/",
    projectId: "silver-fa4e9",
    storageBucket: "silver-fa4e9.firebasestorage.app",
    messagingSenderId: "993522816037",
    appId: "1:993522816037:web:2ca86066b63df96c169bcc",
};
firebase.initializeApp(firebaseConfig);
firebase.analytics();

var invoices = firebase.database().ref("Invoices");
var items = firebase.database().ref("Items");

let currentInvoiceId = null;
let sum = 0;

const stavkeForm = document.getElementById("stavkeForm");
const ukupnaCijenaDiv = document.getElementById("ukupnaCijenaDiv");
const ukupnaCijenaDiv2 = document.getElementById("ukupnaCijenaDiv2");
const stavkeDiv = document.getElementById("stavkeDiv");

// Funkcija za kreiranje računa
async function createInvoiceIfNotExists() {
    if (!currentInvoiceId) {
        const type = document.querySelector('input[name="vrstaDokumenta"]:checked')?.value;
        const date = document.getElementById("datumRacuna").value;
        const time = document.getElementById("vrijemeRacuna").value;
        const invoiceNumber = document.getElementById("brojRacuna").value;
        const buyer = document.getElementById("kupac").value;
        const adress = document.getElementById("adresa").value;
        const oib = document.getElementById("OIB").value;

        // Validacija
        if (!type || !date || !time || !invoiceNumber || !buyer || !adress || !oib) {
            alert("Upiši sve stavke u račun/ponudu.");
            return null;
        }
        if (!/^\d{11}$/.test(oib)) {
            alert("OIB mora imati točno 11 znamenki.");
            return null;
        }

        // Kreiranje računa u bazi
        var newInvoices = invoices.push();
        newInvoices.set({
            type: type,
            date: date,
            time: time,
            invoiceNumber: invoiceNumber,
            buyer: buyer,
            adress: adress,
            oib: oib,
            totalPrice: 0, // Početna cijena
        });
        currentInvoiceId = newInvoices.key;
        newInvoices.set({
            id: currentInvoiceId,
        });
    }
    return currentInvoiceId;
}

stavkeForm.onsubmit = async (event) => {
    event.preventDefault();

    // Provjeri postojanje računa
    const invoiceId = await createInvoiceIfNotExists();
    if (!invoiceId) {
        alert("Račun nije kreiran. Dodaj sve potrebne podatke.");
        return;
    }

    const name = document.getElementById("nazivStavke").value;
    const quantity = parseInt(document.getElementById("kolicinaStavke").value);
    const price = document.getElementById("cijenaStavke").value.replace(',', '.');  // Zamjena zareza s točkom
    const unit = document.getElementById("jedinicaMjere").value;

    // Validacija unosa stavki
    if (!name || isNaN(quantity) || isNaN(price) || !unit) {
        alert("Unesi sve podatke za stavku.");
        return;
    }

    // Dodavanje stavke u bazu
    var newItem = items.push();
    newItem.set({
        invoiceId: invoiceId,
        name: name,
        quantity: quantity,
        price: parseFloat(price),  // Parsiranje cijene s točkom
        unit: unit,
    });

    // Dodavanje u DOM
    addStavkaToDOM({ id: newItem.key, name, quantity, unit, price });
    
    // Ažuriraj ukupnu cijenu iz baze
    await updateInvoiceTotal();
    
    stavkeForm.reset();
};

function addStavkaToDOM({ id, name, quantity, unit, price }) {
    const stavkaDiv = document.createElement("div");
    stavkaDiv.classList.add("stavke");
    stavkaDiv.dataset.id = id;

    // Provjera je li jedinica mjere "m2" i formatiranje ispisa
    const displayUnit = "m²";

    stavkaDiv.innerHTML = `
        <div class="stavkeInfo"><p><strong>OPIS:</strong> ${name}</p></div>
        <div class="stavkeInfo"><p><strong>CIJENA:</strong> ${price}€</p></div>
        <div class="stavkeInfo"><p><strong>KOLIČINA:</strong> ${quantity}</p></div>
        <div class="stavkeInfo"><p><strong>JED. MJERE:</strong> ${displayUnit}</p></div>
        <div class="stavkeInfo"><p><strong>IZNOS:</strong> ${(price * quantity).toFixed(2)}€</p></div>
        <div class="gumbiEditX">
            <button class="deleteButton">X</button>
            <button class="editButton">UREDI</button>
        </div>
    `;

    azuriranjeCijene(price, quantity);
    stavkeDiv.appendChild(stavkaDiv);

    // Event za brisanje stavke
    stavkaDiv.querySelector(".deleteButton").addEventListener("click", deleteItem);
    stavkaDiv.querySelector(".editButton").addEventListener("click", async function() {
        editItem(name, price, quantity, unit);
        const stavkaDiv = event.target.closest('.stavke');
        const stavkaId = stavkaDiv.dataset.id;
    
        // Brisanje stavke iz Firebase baze podataka
        await items.child(stavkaId).remove();
        
        // Uklanjanje stavke iz DOM-a
        stavkaDiv.remove();
    
        // Ažuriranje ukupne cijene iz baze
        await updateInvoiceTotal();
    });
}
function editItem(name, price, quantity, unit) {
    // Popunjavanje forme sa podacima odabrane stavke
    document.getElementById('nazivStavke').value = name;
    document.getElementById('jedinicaMjere').value = unit;
    document.getElementById('kolicinaStavke').value = quantity;
    document.getElementById('cijenaStavke').value = price;
}
// Funkcija za brisanje stavke
async function deleteItem(event) {
    const stavkaDiv = event.target.closest('.stavke');
    const stavkaId = stavkaDiv.dataset.id;

    // Brisanje stavke iz Firebase baze podataka
    await items.child(stavkaId).remove();
    
    // Uklanjanje stavke iz DOM-a
    stavkaDiv.remove();

    // Ažuriranje ukupne cijene iz baze
    await updateInvoiceTotal();
}


// Funkcija za ažuriranje cijene
function azuriranjeCijene(price = 0, quantity = 0) {
    // Ako su ovi parametri undefined, ne radi ništa
    if (price !== 0 && quantity !== 0) {
        sum += price * quantity;
    }

    ukupnaCijenaDiv.textContent = `Ukupna cijena: ${sum.toFixed(2)} €`;
    ukupnaCijenaDiv2.textContent = `Ukupna cijena s PDV-om: ${(sum * 1.25).toFixed(2)} €`;
}


const spremiRacunButton = document.getElementById('spremiRacunButton');
spremiRacunButton.addEventListener('click', async () => {

    if (!currentInvoiceId) {
        alert('Dodaj bar jednu stavku prije spremanja računa.');
        return;
    }

    // Ažuriraj detalje računa (uz validaciju)
    const type = document.querySelector('input[name="vrstaDokumenta"]:checked')?.value;
    const date = document.getElementById('datumRacuna').value;
    const time = document.getElementById('vrijemeRacuna').value;
    const invoiceNumber = document.getElementById('brojRacuna').value;
    const buyer = document.getElementById('kupac').value;
    const adress = document.getElementById('adresa').value;
    const oib = document.getElementById('OIB').value;

    // Validacija
    if (!type || !date || !time || !invoiceNumber || !buyer || !adress || !oib) {
        alert('Upiši sve podatke u račun.');
        return;
    }

    // Ažuriraj račun u bazi
    await updateInvoiceDetails();

    // Ažuriraj ukupnu cijenu
    await updateInvoiceTotal(currentInvoiceId);

    // Preusmjeri korisnika natrag na početnu stranicu
    window.location.href = './index.html';
});

// Funkcija za ažuriranje ukupne cijene računa
// Funkcija za ažuriranje ukupne cijene računa
// Funkcija za ažuriranje ukupne cijene računa
async function updateInvoiceTotal() {
    if (!currentInvoiceId) {
        console.error("Greška: Trenutni račun nije postavljen!");
        return;
    }

    console.log("Dohvaćanje stavki za račun:", currentInvoiceId);
    const snapshot = await items.orderByChild("invoiceId").equalTo(currentInvoiceId).once("value");

    if (!snapshot.exists()) {
        console.error("Nema stavki za račun.");
        return;
    }

    const itemsData = snapshot.val();
    console.log("Stavke dohvaćene:", itemsData);

    let totalPrice = 0;
    // Zbrajanje cijena svih stavki koje pripadaju trenutnom računu
    for (const key in itemsData) {
        totalPrice += itemsData[key].price * itemsData[key].quantity;  // Cijena stavke * količina
    }

    console.log("Ukupna cijena:", totalPrice);

    const invoiceRef = firebase.database().ref(`Invoices/${currentInvoiceId}`);
    await invoiceRef.update({
        totalPrice: (totalPrice*1.25).toFixed(2),  // Ažuriranje ukupne cijene bez PDV-a
    });

    // Ažuriranje prikaza u DOM-u
    ukupnaCijenaDiv.textContent = `Ukupna cijena: ${totalPrice.toFixed(2)} €`;
    ukupnaCijenaDiv2.textContent = `Ukupna cijena s PDV-om: ${(totalPrice * 1.25).toFixed(2)} €`;

    console.log("Račun uspješno ažuriran.");
}


async function updateInvoiceDetails() {
    if (!currentInvoiceId) {
        alert("Nema trenutnog računa za ažuriranje.");
        return;
    }

    // Dohvaćanje podataka iz forme
    const type = document.querySelector('input[name="vrstaDokumenta"]:checked')?.value;
    const date = document.getElementById('datumRacuna').value;
    const time = document.getElementById('vrijemeRacuna').value;
    const invoiceNumber = document.getElementById('brojRacuna').value;
    const buyer = document.getElementById('kupac').value;
    const adress = document.getElementById('adresa').value;
    const oib = document.getElementById('OIB').value;

    // Validacija: Provjera unesenih podataka
    if (!type || !date || !time || !invoiceNumber || !buyer || !adress || !oib) {
        alert("Upiši sve stavke u račun/ponudu.");
        return;
    }

    if (!/^\d{11}$/.test(oib)) {
        alert("OIB mora imati točno 11 znamenki.");
        return;
    }

    try {
        // Ažuriranje računa u Firebase bazi
        const invoiceRef = firebase.database().ref(`Invoices/${currentInvoiceId}`);
        await invoiceRef.update({
            type,
            date,
            time,
            invoiceNumber,
            buyer,
            adress,
            oib,
        });
    } catch (error) {
        console.error("Greška prilikom ažuriranja računa:", error);
        alert("Došlo je do pogreške prilikom ažuriranja računa.");
    }
}


const urlParams = new URLSearchParams(window.location.search);
currentInvoiceId = urlParams.get('id'); // Dohvati ID kao string

if (currentInvoiceId) {
    loadInvoice(currentInvoiceId); // Prosljeđuje string ID u funkciju loadInvoice
    
}

// Funkcija za učitavanje računa
async function loadInvoice(id) {
    const invoiceRef = firebase.database().ref(`Invoices/${id}`);
    const invoiceSnapshot = await invoiceRef.once('value');
    
    // Provjeri postoji li račun
    if (!invoiceSnapshot.exists()) {
        console.error("Račun nije pronađen.");
        return;
    }
    
    // Dohvati podatke o računu
    const invoice = invoiceSnapshot.val();
    console.log("Račun podaci:", invoice);

    // Popuni podatke u formi
    document.querySelector(`input[name="vrstaDokumenta"][value="${invoice.type}"]`).checked = true;
    document.getElementById('datumRacuna').value = invoice.date;
    document.getElementById('vrijemeRacuna').value = invoice.time;
    document.getElementById('brojRacuna').value = invoice.invoiceNumber;
    document.getElementById('kupac').value = invoice.buyer;
    document.getElementById('adresa').value = invoice.adress;
    document.getElementById('OIB').value = invoice.oib;

    // Dohvati stavke povezane s ovim računom
    const itemsSnapshot = await items.orderByChild("invoiceId").equalTo(id).once("value");

    // Provjeri postoji li stavki za račun
    if (itemsSnapshot.exists()) {
        const itemsData = itemsSnapshot.val();
        // Dodaj svaku stavku u DOM
        for (const key in itemsData) {
            const item = itemsData[key];
            addStavkaToDOM({
                id: key,
                name: item.name,
                quantity: item.quantity,
                unit: item.unit,
                price: item.price
            });
        }
    } else {
        console.log("Nema stavki za ovaj račun.");
    }
}







