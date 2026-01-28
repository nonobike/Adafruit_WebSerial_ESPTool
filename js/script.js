// Script principal pour Adafruit WebSerial ESPTool
console.log('Script chargé');

// Attendre que TOUT soit chargé
window.addEventListener('load', function() {
  console.log('Window load event');
  initApp();
});

function initApp() {
  console.log('Initialisation de l\'application...');
  
  // Vérification WebSerial
  if (!("serial" in navigator)) {
    console.error('WebSerial non supporté');
    const notSupported = document.getElementById("notSupported");
    if (notSupported) {
      notSupported.style.display = "block";
    }
    return;
  }
  
  console.log('WebSerial supporté ✓');
  
  // Cacher le message d'erreur
  const notSupported = document.getElementById("notSupported");
  if (notSupported) {
    notSupported.style.display = "none";
  }
  
  // Variables globales
  let port = null;
  let isConnected = false;
  
  // Récupérer tous les éléments
  const connectButton = document.getElementById('butConnect');
  const baudRateSelect = document.getElementById('baudRate');
  const firmwarePicker = document.getElementById('firmware-picker');
  const programButton = document.getElementById('programButton');
  const eraseButton = document.getElementById('eraseButton');
  const consoleElement = document.getElementById('console');
  const darkmodeToggle = document.getElementById('darkmode');
  
  // Vérifier que les éléments critiques existent
  console.log('Vérification des éléments DOM:');
  console.log('- connectButton:', connectButton ? '✓' : '✗');
  console.log('- baudRateSelect:', baudRateSelect ? '✓' : '✗');
  console.log('- firmwarePicker:', firmwarePicker ? '✓' : '✗');
  console.log('- programButton:', programButton ? '✓' : '✗');
  console.log('- eraseButton:', eraseButton ? '✓' : '✗');
  console.log('- consoleElement:', consoleElement ? '✓' : '✗');
  
  // Fonction de log
  function log(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    let prefix = 'ℹ️';
    
    if (type === 'error') prefix = '❌';
    else if (type === 'warning') prefix = '⚠️';
    else if (type === 'success') prefix = '✅';
    
    const logMessage = `[${timestamp}] ${prefix} ${message}`;
    
    if (consoleElement) {
      consoleElement.textContent += logMessage + '\n';
      consoleElement.scrollTop = consoleElement.scrollHeight;
    }
    
    console.log(logMessage);
  }
  
  // Message de bienvenue
  log('═══════════════════════════════════════');
  log('Adafruit WebSerial ESPTool');
  log('Prêt à programmer votre ESP32');
  log('═══════════════════════════════════════');
  
  // Remplir le select des vitesses de baud
  if (baudRateSelect) {
    const baudRates = [9600, 57600, 115200, 230400, 460800, 921600];
    baudRates.forEach(rate => {
      const option = document.createElement('option');
      option.value = rate;
      option.textContent = rate + ' baud';
      if (rate === 115200) {
        option.selected = true;
      }
      baudRateSelect.appendChild(option);
    });
    log('Vitesses de baud configurées', 'success');
  }
  
  // Afficher les infos du firmware
  function updateFirmwareInfo() {
    if (!firmwarePicker) return;
    
    const selectedFirmware = firmwarePicker.value;
    const firmwareInfo = document.getElementById('firmware-info');
    const firmwareDescription = document.getElementById('firmware-description');
    
    if (selectedFirmware && window.firmwareManifests && window.firmwareManifests[selectedFirmware]) {
      const firmware = window.firmwareManifests[selectedFirmware];
      
      if (firmwareInfo) {
        firmwareInfo.style.display = 'block';
      }
      
      if (firmwareDescription) {
        firmwareDescription.innerHTML = `
          <strong>${firmware.name}</strong><br>
          Version: ${firmware.version}<br>
          ${firmware.description || ''}
        `;
      }
      
      log('Firmware sélectionné: ' + firmware.name, 'success');
    } else {
      if (firmwareInfo) {
        firmwareInfo.style.display = 'none';
      }
    }
  }
  
  // Initialiser l'affichage du firmware
  updateFirmwareInfo();
  
  // Event: changement de firmware
  if (firmwarePicker) {
    firmwarePicker.addEventListener('change', updateFirmwareInfo);
  }
  
  // Event: bouton Connect/Disconnect
  if (connectButton) {
    connectButton.addEventListener('click', async function() {
      if (!isConnected) {
        // CONNEXION
        try {
          log('Sélection du port série...');
          
          // Demander le port
          port = await navigator.serial.requestPort();
          
          // Obtenir la vitesse
          const baudRate = baudRateSelect ? parseInt(baudRateSelect.value) : 115200;
          
          // Ouvrir le port
          await port.open({ baudRate: baudRate });
          
          isConnected = true;
          connectButton.textContent = 'Disconnect';
          connectButton.style.backgroundColor = '#c64141';
          connectButton.style.borderColor = '#900';
          
          // Activer les boutons
          if (programButton) programButton.disabled = false;
          if (eraseButton) eraseButton.disabled = false;
          
          log(`Connecté au port série (${baudRate} baud)`, 'success');
          
        } catch (error) {
          log('Erreur de connexion: ' + error.message, 'error');
          console.error(error);
        }
        
      } else {
        // DÉCONNEXION
        try {
          log('Déconnexion...');
          
          if (port) {
            await port.close();
          }
          
          isConnected = false;
          port = null;
          connectButton.textContent = 'Connect';
          connectButton.style.backgroundColor = '#000';
          connectButton.style.borderColor = '#fff';
          
          // Désactiver les boutons
          if (programButton) programButton.disabled = true;
          if (eraseButton) eraseButton.disabled = true;
          
          log('Déconnecté', 'success');
          
        } catch (error) {
          log('Erreur de déconnexion: ' + error.message, 'error');
          console.error(error);
        }
      }
    });
  }
  
  // Event: bouton Program
  if (programButton) {
    programButton.addEventListener('click', async function() {
      if (!isConnected) {
        log('Erreur: Connectez-vous d\'abord à l\'ESP32', 'error');
        return;
      }
      
      const selectedFirmware = firmwarePicker ? firmwarePicker.value : null;
      
      if (!selectedFirmware || !window.firmwareManifests || !window.firmwareManifests[selectedFirmware]) {
        log('Erreur: Firmware non valide', 'error');
        return;
      }
      
      const firmware = window.firmwareManifests[selectedFirmware];
      
      log('═══════════════════════════════════════');
      log('Début de la programmation');
      log('Firmware: ' + firmware.name + ' v' + firmware.version);
      log('═══════════════════════════════════════');
      
      // Afficher les fichiers
      if (firmware.builds && firmware.builds[0] && firmware.builds[0].parts) {
        log('Fichiers à flasher:');
        firmware.builds[0].parts.forEach((part, index) => {
          log(`  ${index + 1}. ${part.path} @ 0x${part.offset.toString(16).toUpperCase()}`);
        });
      }
      
      log('⚠️ Intégration esptool.js nécessaire', 'warning');
      log('Fonctionnalité en développement');
    });
  }
  
  // Event: bouton Erase
  if (eraseButton) {
    eraseButton.addEventListener('click', async function() {
      if (!isConnected) {
        log('Erreur: Connectez-vous d\'abord à l\'ESP32', 'error');
        return;
      }
      
      const confirmed = confirm(
        '⚠️ ATTENTION ⚠️\n\n' +
        'Voulez-vous vraiment effacer TOUTE la mémoire flash de l\'ESP32 ?\n\n' +
        'Cette action est IRRÉVERSIBLE !'
      );
      
      if (confirmed) {
        log('═══════════════════════════════════════');
        log('Effacement de la flash');
        log('═══════════════════════════════════════');
        log('⚠️ Intégration esptool.js nécessaire', 'warning');
        log('Fonctionnalité en développement');
      }
    });
  }
  
  // Event: Dark mode toggle
  if (darkmodeToggle) {
    darkmodeToggle.addEventListener('change', function() {
      if (this.checked) {
        document.body.classList.add('dark-mode');
        log('Mode sombre activé');
      } else {
        document.body.classList.remove('dark-mode');
        log('Mode clair activé');
      }
    });
  }
  
  console.log('Initialisation terminée ✓');
}
