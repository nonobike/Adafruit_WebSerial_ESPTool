console.log('Script chargé');

window.addEventListener('load', function() {
  console.log('Window load event');
  initApp();
});

function initApp() {
  console.log('Initialisation de l\'application...');

  if (!("serial" in navigator)) {
    console.error('WebSerial non supporté');
    const notSupported = document.getElementById("notSupported");
    if (notSupported) {
      notSupported.style.display = "block";
    }
    return;
  }

  console.log('WebSerial supporté ✓');

  const notSupported = document.getElementById("notSupported");
  if (notSupported) {
    notSupported.style.display = "none";
  }

  let port = null;
  let isConnected = false;
  
  const connectButton = document.getElementById('butConnect');
  const baudRateSelect = document.getElementById('baudRate');
  const firmwarePicker = document.getElementById('firmware-picker');
  const programButton = document.getElementById('programButton');
  const eraseButton = document.getElementById('eraseButton');
  const consoleElement = document.getElementById('console');

  console.log('Vérification des éléments DOM:');
  console.log('- connectButton:', connectButton ? '✓' : '✗');
  console.log('- baudRateSelect:', baudRateSelect ? '✓' : '✗');
  console.log('- firmwarePicker:', firmwarePicker ? '✓' : '✗');
  console.log('- programButton:', programButton ? '✓' : '✗');
  console.log('- eraseButton:', eraseButton ? '✓' : '✗');
  console.log('- consoleElement:', consoleElement ? '✓' : '✗');

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

  log('Attente de connexion');

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
  }

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

    } else {
      if (firmwareInfo) {
        firmwareInfo.style.display = 'none';
      }
    }
  }

  updateFirmwareInfo();

  if (firmwarePicker) {
    firmwarePicker.addEventListener('change', updateFirmwareInfo);
  }

  if (connectButton) {
    connectButton.addEventListener('click', async function() {
      if (!isConnected) {
        // CONNEXION
        try {
          log('Sélection du port série...');

          port = await navigator.serial.requestPort();

          const baudRate = baudRateSelect ? parseInt(baudRateSelect.value) : 115200;

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

  console.log('Initialisation terminée ✓');
}
