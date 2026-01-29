console.log('Script chargé');

// Attendre que le DOM soit entièrement chargé
document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM entièrement chargé');

  // Variables globales pour esptool-js
  let port = null;
  let isConnected = false;
  let esploader = null;
  let transport = null;
  let chip = null;

  // Récupération des éléments DOM
  const connectButton = document.getElementById('butConnect');
  const baudRateSelect = document.getElementById('baudRate');
  const firmwarePicker = document.getElementById('firmware-picker');
  const programButton = document.getElementById('programButton');
  const eraseButton = document.getElementById('eraseButton');
  const consoleElement = document.getElementById('console');

  // Vérification du support de WebSerial
  if (!("serial" in navigator)) {
    console.error('WebSerial non supporté');
    const notSupported = document.getElementById("notSupported");
    if (notSupported) notSupported.style.display = "block";
    return;
  } else {
    const notSupported = document.getElementById("notSupported");
    if (notSupported) notSupported.style.display = "none";
  }

  console.log('WebSerial supporté ✓');

  // Fonction pour afficher des logs dans la console
  function log(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    let prefix = 'ℹ️';

    if (type === 'error') prefix = '❌';
    else if (type === 'warning') prefix = '⚠️';
    else if (type === 'success') prefix = '✅';
    else if (type === 'progress') prefix = '📊';

    const logMessage = `[${timestamp}] ${prefix} ${message}`;

    if (consoleElement) {
      consoleElement.textContent += logMessage + '\n';
      consoleElement.scrollTop = consoleElement.scrollHeight;
    }

    if (type === 'error') {
      console.error(message);
    } else {
      console.log(logMessage);
    }
  }

  // Terminal pour esptool-js
  const espLoaderTerminal = {
    clean() {
      if (consoleElement) consoleElement.textContent = '';
    },
    writeLine(data) {
      log(data);
    },
    write(data) {
      if (consoleElement) {
        consoleElement.textContent += data;
        consoleElement.scrollTop = consoleElement.scrollHeight;
      }
    }
  };

  // Configuration des vitesses de baud
  if (baudRateSelect) {
    const baudRates = [9600, 57600, 115200, 230400, 460800, 921600];
    baudRates.forEach(rate => {
      const option = document.createElement('option');
      option.value = rate;
      option.textContent = `${rate} baud`;
      if (rate === 115200) option.selected = true;
      baudRateSelect.appendChild(option);
    });
    log('Vitesses de baud configurées', 'success');
  }

  // Mise à jour des informations sur le firmware sélectionné
  function updateFirmwareInfo() {
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
      log(`Firmware sélectionné: ${firmware.name}`, 'success');
    } else {
      if (firmwareInfo) firmwareInfo.style.display = 'none';
    }
  }

  // Initialisation des informations sur le firmware
  updateFirmwareInfo();
  if (firmwarePicker) firmwarePicker.addEventListener('change', updateFirmwareInfo);

  // Fonction pour charger un fichier binaire
  async function loadBinaryFile(filepath) {
    try {
      log(`Téléchargement: ${filepath}...`);
      const response = await fetch(filepath);
      if (!response.ok) throw new Error(`Fichier introuvable: ${filepath}`);
      const arrayBuffer = await response.arrayBuffer();
      log(`✓ ${filepath} chargé (${arrayBuffer.byteLength} octets)`, 'success');
      return arrayBuffer;
    } catch (error) {
      log(`Erreur de chargement: ${error.message}`, 'error');
      throw error;
    }
  }

  // Gestion de la connexion/déconnexion
  if (connectButton) {
    connectButton.addEventListener('click', async function() {
      if (!isConnected) {
        // Connexion
        try {
          log('Sélection du port série...');

          // Vérification de la disponibilité d'esptool-js
          if (typeof esptool === 'undefined') {
            throw new Error('esptool-js n\'est pas chargé. Vérifiez le CDN ou votre connexion internet.');
          }

          port = await navigator.serial.requestPort();
          const baudRate = baudRateSelect ? parseInt(baudRateSelect.value) : 115200;

          log(`Connexion en cours à ${baudRate} baud...`);

          // Initialisation du transport et de l'ESPLoader
transport = new window.esptool.Transport(port);
esploader = new window.esptool.ESPLoader({
  transport: transport,
  baudrate: baudRate,
  terminal: espLoaderTerminal
});


          // Connexion et détection du chip
          log('Détection du chip ESP...');
          chip = await esploader.main();

          isConnected = true;
          connectButton.textContent = 'Déconnecter';
          connectButton.style.backgroundColor = '#c64141';
          connectButton.style.borderColor = '#900';

          if (programButton) programButton.disabled = false;
          if (eraseButton) eraseButton.disabled = false;

          log('═══════════════════════════════════════');
          log(`✅ CONNECTÉ AVEC SUCCÈS`, 'success');
          log(`Chip: ${chip}`, 'success');
          const macAddr = await esploader.chipName();
          log(`MAC: ${macAddr}`, 'success');
          log('═══════════════════════════════════════');

        } catch (error) {
          log(`Erreur de connexion: ${error.message}`, 'error');
          console.error(error);
          isConnected = false;

          if (error.message.includes('esptool')) {
            log('💡 Vérifiez votre connexion internet (CDN esptool-js)', 'warning');
          } else if (error.message.includes('Failed to open')) {
            log('💡 Fermez Arduino IDE / PlatformIO / moniteurs série', 'warning');
          }
        }
      } else {
        // Déconnexion
        try {
          log('Déconnexion...');

          if (esploader) {
            await esploader.hardReset();
            await esploader.disconnect();
          }

          isConnected = false;
          port = null;
          esploader = null;
          transport = null;
          chip = null;

          connectButton.textContent = 'Connecter';
          connectButton.style.backgroundColor = '#000';
          connectButton.style.borderColor = '#fff';

          if (programButton) programButton.disabled = true;
          if (eraseButton) eraseButton.disabled = true;

          log('Déconnecté', 'success');

        } catch (error) {
          log(`Erreur de déconnexion: ${error.message}`, 'error');
          console.error(error);
        }
      }
    });
  }

  // Gestion de la programmation du firmware
  if (programButton) {
    programButton.addEventListener('click', async function() {
      if (!isConnected || !esploader) {
        log('Erreur: Connectez-vous d\'abord à l\'ESP32', 'error');
        return;
      }

      const selectedFirmware = firmwarePicker ? firmwarePicker.value : null;

      if (!selectedFirmware || !window.firmwareManifests || !window.firmwareManifests[selectedFirmware]) {
        log('Erreur: Firmware non valide', 'error');
        return;
      }

      const firmware = window.firmwareManifests[selectedFirmware];

      // Désactiver les boutons pendant le flashage
      programButton.disabled = true;
      eraseButton.disabled = true;
      connectButton.disabled = true;

      try {
        log('═══════════════════════════════════════');
        log('🚀 DÉBUT DE LA PROGRAMMATION');
        log('═══════════════════════════════════════');
        log(`Firmware: ${firmware.name} v${firmware.version}`);

        if (!firmware.builds || !firmware.builds[0] || !firmware.builds[0].parts) {
          throw new Error('Configuration du firmware invalide');
        }

        const parts = firmware.builds[0].parts;
        log(`Fichiers à flasher: ${parts.length}`);

        // Chargement des fichiers binaires
        const fileArray = [];
        for (let i = 0; i < parts.length; i++) {
          const part = parts[i];
          log(`[${i + 1}/${parts.length}] ${part.path} @ 0x${part.offset.toString(16).toUpperCase()}`);
          const data = await loadBinaryFile(part.path);
          fileArray.push({
            data: data,
            address: part.offset
          });
        }

        log('Tous les fichiers sont chargés ✓', 'success');
        log('═══════════════════════════════════════');
        log('📝 Écriture de la flash...');
        log('⚠️ NE DÉBRANCHEZ PAS L\'ESP32 !', 'warning');
        log('═══════════════════════════════════════');

        // Options de flashage
        const flashOptions = {
          fileArray: fileArray,
          flashSize: "keep",
          flashMode: "keep",
          flashFreq: "keep",
          eraseAll: false,
          compress: true,
          reportProgress: (fileIndex, written, total) => {
            const percent = Math.floor((written / total) * 100);
            const fileName = parts[fileIndex].path.split('/').pop();
            log(`[${fileIndex + 1}/${parts.length}] ${fileName} - ${percent}%`, 'progress');
          }
        };

        // Flashage
        await esploader.writeFlash(flashOptions);

        log('═══════════════════════════════════════');
        log('✅ PROGRAMMATION TERMINÉE !', 'success');
        log('═══════════════════════════════════════');
        log('Reset de l\'ESP32...');

        // Reset de l'ESP32
        await esploader.hardReset();

        log('✅ ESP32 redémarré avec le nouveau firmware', 'success');
        log('Vous pouvez débrancher l\'ESP32', 'success');

      } catch (error) {
        log('═══════════════════════════════════════');
        log('❌ ERREUR DE PROGRAMMATION', 'error');
        log('═══════════════════════════════════════');
        log(`Erreur: ${error.message}`, 'error');
        console.error(error);
      } finally {
        // Réactivation des boutons
        programButton.disabled = false;
        eraseButton.disabled = false;
        connectButton.disabled = false;
      }
    });
  }

  // Gestion de l'effacement de la flash
  if (eraseButton) {
    eraseButton.addEventListener('click', async function() {
      if (!isConnected || !esploader) {
        log('Erreur: Connectez-vous d\'abord à l\'ESP32', 'error');
        return;
      }

      const confirmed = confirm(
        '⚠️ ATTENTION ⚠️\n\n' +
        'Voulez-vous vraiment effacer TOUTE la mémoire flash de l\'ESP32 ?\n\n' +
        'Cette action est IRRÉVERSIBLE !'
      );

      if (!confirmed) {
        log('Effacement annulé');
        return;
      }

      // Désactivation des boutons
      programButton.disabled = true;
      eraseButton.disabled = true;
      connectButton.disabled = true;

      try {
        log('═══════════════════════════════════════');
        log('🗑️  EFFACEMENT DE LA FLASH');
        log('═══════════════════════════════════════');
        log('⚠️ NE DÉBRANCHEZ PAS L\'ESP32 !', 'warning');
        log('Cela peut prendre jusqu\'à 30 secondes...');

        await esploader.eraseFlash();

        log('═══════════════════════════════════════');
        log('✅ FLASH EFFACÉE AVEC SUCCÈS !', 'success');
        log('═══════════════════════════════════════');
        log('L\'ESP32 est maintenant vierge');

      } catch (error) {
        log('═══════════════════════════════════════');
        log('❌ ERREUR D\'EFFACEMENT', 'error');
        log('═══════════════════════════════════════');
        log(`Erreur: ${error.message}`, 'error');
        console.error(error);
      } finally {
        // Réactivation des boutons
        programButton.disabled = false;
        eraseButton.disabled = false;
        connectButton.disabled = false;
      }
    });
  }

  log('═══════════════════════════════════════');
  log('Connectez votre carte');
  log('═══════════════════════════════════════');
  log('Initialisation terminée ✓');
});
