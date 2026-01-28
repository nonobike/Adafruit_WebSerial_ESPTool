// Vérification de la compatibilité WebSerial
console.log('🔍 Vérification WebSerial...');

if (!("serial" in navigator)) {
  console.error('❌ WebSerial non disponible');
  const notSupported = document.getElementById("notSupported");
  if (notSupported) {
    notSupported.style.display = "block";
  }
  const content = document.querySelector(".content");
  if (content) {
    content.style.display = "none";
  }
} else {
  console.log('✅ WebSerial disponible');
  const notSupported = document.getElementById("notSupported");
  if (notSupported) {
    notSupported.style.display = "none";
  }
}

// Variables globales
let port;
let reader;
let writer;
let isConnected = false;

// Fonction pour logger dans la console
function logToConsole(message, type = 'info') {
  const consoleElement = document.getElementById('console');
  if (consoleElement) {
    const timestamp = new Date().toLocaleTimeString();
    let prefix = '✅';
    if (type === 'error') prefix = '❌';
    else if (type === 'warning') prefix = '⚠️';
    else if (type === 'info') prefix = 'ℹ️';
    
    consoleElement.textContent += `[${timestamp}] ${prefix} ${message}\n`;
    consoleElement.scrollTop = consoleElement.scrollHeight;
  }
  console.log(message);
}

// Initialisation au chargement de la page
document.addEventListener('DOMContentLoaded', function() {
  console.log('📄 Page chargée, initialisation...');
  
  // Éléments DOM
  const connectButton = document.getElementById('butConnect');
  const baudRateSelect = document.getElementById('baudRate');
  const firmwarePicker = document.getElementById('firmware-picker');
  const programButton = document.getElementById('programButton');
  const eraseButton = document.getElementById('eraseButton');
  const darkmodeToggle = document.getElementById('darkmode');
  
  // Vérifier que tous les éléments existent
  if (!connectButton) console.error('❌ butConnect non trouvé');
  if (!baudRateSelect) console.error('❌ baudRate non trouvé');
  if (!firmwarePicker) console.error('❌ firmware-picker non trouvé');
  if (!programButton) console.error('❌ programButton non trouvé');
  if (!eraseButton) console.error('❌ eraseButton non trouvé');
  
  // Remplir les vitesses de baud
  if (baudRateSelect) {
    const baudRates = [9600, 57600, 115200, 230400, 460800, 921600];
    baudRates.forEach(rate => {
      const option = document.createElement('option');
      option.value = rate;
      option.text = rate + ' baud';
      if (rate === 115200) option.selected = true;
      baudRateSelect.appendChild(option);
    });
    console.log('✅ Vitesses de baud configurées');
  }
  
  // Afficher les infos du firmware sélectionné
  function displayFirmwareInfo() {
    if (!firmwarePicker) return;
    
    const selectedFirmware = firmwarePicker.value;
    const firmwareInfo = document.getElementById('firmware-info');
    const firmwareDescription = document.getElementById('firmware-description');
    
    if (selectedFirmware && window.firmwareManifests && window.firmwareManifests[selectedFirmware]) {
      const firmware = window.firmwareManifests[selectedFirmware];
      if (firmwareInfo) firmwareInfo.style.display = 'block';
      if (firmwareDescription) {
        firmwareDescription.innerHTML = `
          <strong>${firmware.name}</strong><br>
          Version: ${firmware.version}<br>
          ${firmware.description || ''}
        `;
      }
      console.log('✅ Firmware sélectionné:', firmware.name);
    } else {
      if (firmwareInfo) firmwareInfo.style.display = 'none';
    }
  }
  
  // Afficher les infos au chargement
  displayFirmwareInfo();
  
  // Gérer le changement de firmware
  if (firmwarePicker) {
    firmwarePicker.addEventListener('change', displayFirmwareInfo);
  }
  
  // Fonction de connexion
  if (connectButton) {
    connectButton.addEventListener('click', async function() {
      if (!isConnected) {
        try {
          logToConsole('Demande de connexion au port série...');
          
          // Demander à l'utilisateur de sélectionner un port
          port = await navigator.serial.requestPort();
          
          // Ouvrir le port avec la vitesse sélectionnée
          const baudRate = baudRateSelect ? parseInt(baudRateSelect.value) : 115200;
          await port.open({ baudRate: baudRate });
          
          isConnected = true;
          connectButton.textContent = 'Disconnect';
          connectButton.style.backgroundColor = '#c64141';
          connectButton.style.borderColor = '#900';
          
          // Activer les boutons
          if (programButton) programButton.disabled = false;
          if (eraseButton) eraseButton.disabled = false;
          
          logToConsole(`Connecté avec succès au port série (${baudRate} baud)`);
          
        } catch (error) {
          console.error('❌ Erreur de connexion:', error);
          logToConsole('Erreur de connexion: ' + error.message, 'error');
        }
      } else {
        // Déconnexion
        try {
          logToConsole('Déconnexion en cours...');
          
          if (reader) {
            await reader.cancel();
          }
          if (port) {
            await port.close();
          }
          isConnected = false;
          connectButton.textContent = 'Connect';
          connectButton.style.backgroundColor = '#000';
          connectButton.style.borderColor = '#fff';
          
          // Désactiver les boutons
          if (programButton) programButton.disabled = true;
          if (eraseButton) eraseButton.disabled = true;
          
          logToConsole('Déconnecté du port série');
          
        } catch (error) {
          console.error('❌ Erreur de déconnexion:', error);
          logToConsole('Erreur de déconnexion: ' + error.message, 'error');
        }
      }
    });
  }
  
  // Fonction Program
  if (programButton) {
    programButton.addEventListener('click', async function() {
      if (!isConnected) {
        logToConsole('Veuillez d\'abord vous connecter à l\'ESP32', 'error');
        return;
      }
      
      const selectedFirmware = firmwarePicker ? firmwarePicker.value : null;
      if (!selectedFirmware || !window.firmwareManifests || !window.firmwareManifests[selectedFirmware]) {
        logToConsole('Veuillez sélectionner un firmware valide', 'error');
        return;
      }
      
      const firmware = window.firmwareManifests[selectedFirmware];
      logToConsole('═══════════════════════════════════════');
      logToConsole('Démarrage de la programmation...');
      logToConsole('Firmware: ' + firmware.name + ' v' + firmware.version);
      logToConsole('═══════════════════════════════════════');
      
      // Liste des fichiers à flasher
      if (firmware.builds && firmware.builds[0] && firmware.builds[0].parts) {
        firmware.builds[0].parts.forEach((part, index) => {
          logToConsole(`Fichier ${index + 1}: ${part.path} @ 0x${part.offset.toString(16)}`);
        });
      }
      
      logToConsole('⚠️ Intégration esptool.js requise pour le flashage réel', 'warning');
      logToConsole('Cette fonctionnalité sera implémentée prochainement', 'info');
    });
  }
  
  // Fonction Erase
  if (eraseButton) {
    eraseButton.addEventListener('click', async function() {
      if (!isConnected) {
        logToConsole('Veuillez d\'abord vous connecter à l\'ESP32', 'error');
        return;
      }
      
      if (confirm('⚠️ ATTENTION ⚠️\n\nÊtes-vous sûr de vouloir effacer COMPLÈTEMENT la flash de l\'ESP32 ?\n\nCette action est irréversible !')) {
        logToConsole('═══════════════════════════════════════');
        logToConsole('Démarrage de l\'effacement de la flash...');
        logToConsole('═══════════════════════════════════════');
        logToConsole('⚠️ Intégration esptool.js requise pour l\'effacement réel', 'warning');
        logToConsole('Cette fonctionnalité sera implémentée prochainement', 'info');
      }
    });
  }
  
  // Gestion du dark mode
  if (darkmodeToggle) {
    darkmodeToggle.addEventListener('change', function() {
      if (this.checked) {
        document.body.classList.add('dark-mode');
        logToConsole('Mode sombre activé');
      } else {
        document.body.classList.remove('dark-mode');
        logToConsole('Mode clair activé');
      }
    });
  }
  
  // Message de bienvenue
  logToConsole('═══════════════════════════════════════');
  logToConsole('Adafruit WebSerial ESPTool');
  logToConsole('Prêt à flasher votre ESP32 !');
  logToConsole('═══════════════════════════════════════');
});
```

## ✅ Résumé des changements clés :

1. **Tous les éléments HTML nécessaires sont présents** : `console`, `programButton`, `eraseButton`, etc.
2. **Le script vérifie l'existence de chaque élément** avant d'ajouter des event listeners
3. **Messages de log détaillés** pour faciliter le débogage
4. **L'ordre de chargement est correct** : manifests → script.js
5. **Gestion d'erreur robuste** avec try/catch

## 🧪 Test rapide

Après avoir mis à jour ces fichiers :

1. **Rafraîchissez la page** avec `Ctrl + F5`
2. **Ouvrez la console** (F12)
3. Vous devriez voir :
```
   🔍 Vérification WebSerial...
   ✅ WebSerial disponible
   📄 Page chargée, initialisation...
   ✅ Vitesses de baud configurées
   ✅ Firmware sélectionné: Mon Firmware ESP32 Personnalisé
