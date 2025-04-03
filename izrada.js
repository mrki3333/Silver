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

// Funkcija za dohvaćanje posljednjeg broja računa/ponude
async function getLastInvoiceNumber(type) {
    try {
        const snapshot = await invoices
            .orderByChild("type")
            .equalTo(type)
            .once("value");

        if (!snapshot.exists()) {
            return "Nema dostupnih računa";
        }

        const invoicesData = snapshot.val();
        let lastInvoice = null;
        let highestNumber = 0;

        for (const key in invoicesData) {
            const invoice = invoicesData[key];
            const invoiceNumber = parseInt(invoice.invoiceNumber);
            
            if (!isNaN(invoiceNumber) && invoiceNumber > highestNumber) {
                highestNumber = invoiceNumber;
                lastInvoice = invoice;
            }
        }

        return lastInvoice ? lastInvoice.invoiceNumber : "Nema dostupne niti jedne ponude";
    } catch (error) {
        console.error("Greška pri dohvatu zadnjeg računa:", error);
        return "Greška pri dohvatu";
    }
}

// Funkcija za ažuriranje prikaza posljednjeg broja
async function updateLastInvoiceDisplay() {
    const selectedType = document.querySelector('input[name="vrstaDokumenta"]:checked')?.value;
    if (selectedType) {
        const lastNumber = await getLastInvoiceNumber(selectedType);
        if(selectedType == "Račun"){
            document.getElementById("zadnjiBrojInfo").textContent = `Posljednji broj računa: ${lastNumber}`;
        }
        else{
            document.getElementById("zadnjiBrojInfo").textContent = `Posljednji broj ponude: ${lastNumber}`;
        }
    }
}

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
            totalPrice: 0,
        });
        currentInvoiceId = newInvoices.key;
        newInvoices.set({
            id: currentInvoiceId,
        });

        // Osvježi prikaz posljednjeg broja
        await updateLastInvoiceDisplay();
    }
    return currentInvoiceId;
}

// Event listeneri za radio buttone
document.querySelectorAll('input[name="vrstaDokumenta"]').forEach(radio => {
    radio.addEventListener('change', updateLastInvoiceDisplay);
});

// Inicijalno postavljanje pri učitavanju stranice
document.addEventListener('DOMContentLoaded', async () => {
    // Postavi defaultni tip ako je potrebno
    const defaultType = document.querySelector('input[name="vrstaDokumenta"]:checked')?.value;
    if (defaultType) {
        await updateLastInvoiceDisplay();
    }
});

stavkeForm.onsubmit = async (event) => {
    event.preventDefault();

    const invoiceId = await createInvoiceIfNotExists();
    if (!invoiceId) {
        alert("Račun nije kreiran. Dodaj sve potrebne podatke.");
        return;
    }

    const name = document.getElementById("nazivStavke").value;
    const quantity = parseInt(document.getElementById("kolicinaStavke").value);
    const price = document.getElementById("cijenaStavke").value.replace(',', '.');
    const unit = document.getElementById("jedinicaMjere").value;

    if (!name || isNaN(quantity) || isNaN(price) || !unit) {
        alert("Unesi sve podatke za stavku.");
        return;
    }

    var newItem = items.push();
    newItem.set({
        invoiceId: invoiceId,
        name: name,
        quantity: quantity,
        price: parseFloat(price),
        unit: unit,
    });

    addStavkaToDOM({ id: newItem.key, name, quantity, unit, price });
    await updateInvoiceTotal();
    stavkeForm.reset();
};

function addStavkaToDOM({ id, name, quantity, unit, price }) {
    const stavkaDiv = document.createElement("div");
    stavkaDiv.classList.add("stavke");
    stavkaDiv.dataset.id = id;

    stavkaDiv.innerHTML = `
        <div class="stavkeInfo"><p><strong>OPIS:</strong> ${name}</p></div>
        <div class="stavkeInfo"><p><strong>CIJENA:</strong> ${price}€</p></div>
        <div class="stavkeInfo"><p><strong>KOLIČINA:</strong> ${quantity}</p></div>
        <div class="stavkeInfo"><p><strong>JED. MJERE:</strong> ${unit}</p></div>
        <div class="stavkeInfo"><p><strong>IZNOS:</strong> ${(price * quantity).toFixed(2)}€</p></div>
        <div class="gumbiEditX">
            <button class="deleteButton">X</button>
            <button class="editButton">UREDI</button>
        </div>
    `;

    azuriranjeCijene(price, quantity);
    stavkeDiv.appendChild(stavkaDiv);

    stavkaDiv.querySelector(".deleteButton").addEventListener("click", deleteItem);
    stavkaDiv.querySelector(".editButton").addEventListener("click", async function() {
        editItem(name, price, quantity, unit);
        const stavkaDiv = this.closest('.stavke');
        const stavkaId = stavkaDiv.dataset.id;
        await items.child(stavkaId).remove();
        stavkaDiv.remove();
        await updateInvoiceTotal();
    });
}

function editItem(name, price, quantity, unit) {
    document.getElementById('nazivStavke').value = name;
    document.getElementById('jedinicaMjere').value = unit;
    document.getElementById('kolicinaStavke').value = quantity;
    document.getElementById('cijenaStavke').value = price;
}

async function deleteItem(event) {
    const stavkaDiv = event.target.closest('.stavke');
    const stavkaId = stavkaDiv.dataset.id;
    await items.child(stavkaId).remove();
    stavkaDiv.remove();
    await updateInvoiceTotal();
}

function azuriranjeCijene(price = 0, quantity = 0) {
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

    const type = document.querySelector('input[name="vrstaDokumenta"]:checked')?.value;
    const date = document.getElementById('datumRacuna').value;
    const time = document.getElementById('vrijemeRacuna').value;
    const invoiceNumber = document.getElementById('brojRacuna').value;
    const buyer = document.getElementById('kupac').value;
    const adress = document.getElementById('adresa').value;
    const oib = document.getElementById('OIB').value;

    if (!type || !date || !time || !invoiceNumber || !buyer || !adress || !oib) {
        alert('Upiši sve podatke u račun.');
        return;
    }

    await updateInvoiceDetails();
    await updateInvoiceTotal();
    window.location.href = './index.html';
});

async function updateInvoiceTotal() {
    if (!currentInvoiceId) {
        console.error("Greška: Trenutni račun nije postavljen!");
        return;
    }

    const snapshot = await items.orderByChild("invoiceId").equalTo(currentInvoiceId).once("value");
    if (!snapshot.exists()) {
        console.error("Nema stavki za račun.");
        return;
    }

    const itemsData = snapshot.val();
    let totalPrice = 0;
    for (const key in itemsData) {
        totalPrice += itemsData[key].price * itemsData[key].quantity;
    }

    const invoiceRef = firebase.database().ref(`Invoices/${currentInvoiceId}`);
    await invoiceRef.update({
        totalPrice: (totalPrice*1.25).toFixed(2),
    });

    ukupnaCijenaDiv.textContent = `Ukupna cijena: ${totalPrice.toFixed(2)} €`;
    ukupnaCijenaDiv2.textContent = `Ukupna cijena s PDV-om: ${(totalPrice * 1.25).toFixed(2)} €`;
}

async function updateInvoiceDetails() {
    if (!currentInvoiceId) {
        alert("Nema trenutnog računa za ažuriranje.");
        return;
    }

    const type = document.querySelector('input[name="vrstaDokumenta"]:checked')?.value;
    const date = document.getElementById('datumRacuna').value;
    const time = document.getElementById('vrijemeRacuna').value;
    const invoiceNumber = document.getElementById('brojRacuna').value;
    const buyer = document.getElementById('kupac').value;
    const adress = document.getElementById('adresa').value;
    const oib = document.getElementById('OIB').value;

    if (!type || !date || !time || !invoiceNumber || !buyer || !adress || !oib) {
        alert("Upiši sve stavke u račun/ponudu.");
        return;
    }

    if (!/^\d{11}$/.test(oib)) {
        alert("OIB mora imati točno 11 znamenki.");
        return;
    }

    try {
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
currentInvoiceId = urlParams.get('id');

if (currentInvoiceId) {
    loadInvoice(currentInvoiceId);
}

async function loadInvoice(id) {
    const invoiceRef = firebase.database().ref(`Invoices/${id}`);
    const invoiceSnapshot = await invoiceRef.once('value');
    
    if (!invoiceSnapshot.exists()) {
        console.error("Račun nije pronađen.");
        return;
    }
    
    const invoice = invoiceSnapshot.val();
    document.querySelector(`input[name="vrstaDokumenta"][value="${invoice.type}"]`).checked = true;
    document.getElementById('datumRacuna').value = invoice.date;
    document.getElementById('vrijemeRacuna').value = invoice.time;
    document.getElementById('brojRacuna').value = invoice.invoiceNumber;
    document.getElementById('kupac').value = invoice.buyer;
    document.getElementById('adresa').value = invoice.adress;
    document.getElementById('OIB').value = invoice.oib;

    // Osvježi prikaz posljednjeg broja
    await updateLastInvoiceDisplay();

    const itemsSnapshot = await items.orderByChild("invoiceId").equalTo(id).once("value");
    if (itemsSnapshot.exists()) {
        const itemsData = itemsSnapshot.val();
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
