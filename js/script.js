// Script principal avec intégration esptool-js
console.log('Script chargé');

// Variables globales pour esptool
let esploader = null;
let chip = null;

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
    else if (type === 'progress') prefix = '📊';

    const logMessage = `[${timestamp}] ${prefix} ${message}`;

    if (consoleElement) {
      consoleElement.textContent += logMessage + '\n';
      consoleElement.scrollTop = consoleElement.scrollHeight;
    }

    console.log(logMessage);
  }

  // Terminal pour esptool-js
  const espLoaderTerminal = {
    clean() {
      if (consoleElement) {
        consoleElement.textContent = '';
      }
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

  log('═══════════════════════════════════════');
  log('Connectez votre carte');
  log('═══════════════════════════════════════');

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

          // Demander le port
          port = await navigator.serial.requestPort();

          const baudRate = baudRateSelect ? parseInt(baudRateSelect.value) : 115200;

          log(`Connexion en cours à ${baudRate} baud...`);

          // Vérifier que esptool-js est chargé
          if (typeof esptoolPackage === 'undefined') {
            throw new Error('esptool-js n\'est pas chargé. Vérifiez que le CDN est accessible.');
          }

          // Créer l'instance ESPLoader
          esploader = new esptoolPackage.ESPLoader({
            transport: new esptoolPackage.Transport(port),
            baudrate: baudRate,
            terminal: espLoaderTerminal
          });

          // Se connecter et détecter le chip
          log('Détection du chip ESP...');
          chip = await esploader.main();

          isConnected = true;
          connectButton.textContent = 'Disconnect';
          connectButton.style.backgroundColor = '#c64141';
          connectButton.style.borderColor = '#900';

          // Activer les boutons
          if (programButton) programButton.disabled = false;
          if (eraseButton) eraseButton.disabled = false;

          log(`Connecté avec succès!`, 'success');
          log(`Chip détecté: ${chip}`, 'success');
          
          // Afficher l'adresse MAC si disponible
          try {
            const macAddr = await esploader.chipName();
            log(`MAC Address: ${macAddr}`, 'success');
          } catch (e) {
            // Ignorer si non disponible
          }

        } catch (error) {
          log('Erreur de connexion: ' + error.message, 'error');
          console.error(error);
          isConnected = false;
          
          // Suggestions
          if (error.message.includes('esptool-js')) {
            log('💡 Vérifiez votre connexion internet (CDN esptool-js)', 'warning');
          } else if (error.message.includes('Failed to open')) {
            log('💡 Fermez Arduino IDE ou tout moniteur série', 'warning');
          }
        }

      } else {
        // DÉCONNEXION
        try {
          log('Déconnexion...');

          if (esploader) {
            await esploader.hardReset();
            await esploader.disconnect();
          }

          isConnected = false;
          port = null;
          esploader = null;
          chip = null;
          
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

  // Fonction pour charger un fichier binaire
  async function loadBinaryFile(filepath) {
    try {
      log(`Chargement de ${filepath}...`);
      const response = await fetch(filepath);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${filepath}`);
      }
      const data = await response.arrayBuffer();
      log(`✓ ${filepath.split('/').pop()} chargé (${(data.byteLength / 1024).toFixed(1)} Ko)`, 'success');
      return data;
    } catch (error) {
      log(`Erreur: ${error.message}`, 'error');
      throw error;
    }
  }

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
        log('Firmware: ' + firmware.name + ' v' + firmware.version);

        // Vérifier la configuration
        if (!firmware.builds || !firmware.builds[0] || !firmware.builds[0].parts) {
          throw new Error('Configuration du firmware invalide');
        }

        const parts = firmware.builds[0].parts;
        log(`Nombre de fichiers: ${parts.length}`);
        log('');

        // Charger tous les fichiers
        log('📦 Chargement des fichiers...');
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

        log('');
        log('✅ Tous les fichiers chargés avec succès', 'success');
        log('═══════════════════════════════════════');
        log('📝 Écriture de la flash...');
        log('⚠️  NE DÉBRANCHEZ PAS L\'ESP32 !', 'warning');
        log('═══════════════════════════════════════');
        log('');

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
            const writtenKb = (written / 1024).toFixed(1);
            const totalKb = (total / 1024).toFixed(1);
            
            // Afficher seulement à certains intervalles pour éviter de surcharger la console
            if (percent % 10 === 0 || percent === 100) {
              log(`[${fileIndex + 1}/${parts.length}] ${fileName}: ${percent}% (${writtenKb}/${totalKb} Ko)`, 'progress');
            }
          },
          calculateMD5Hash: (image) => CryptoJS.MD5(CryptoJS.lib.WordArray.create(image))
        };

        // Flasher !
        await esploader.writeFlash(flashOptions);

        log('');
        log('═══════════════════════════════════════');
        log('✅ PROGRAMMATION TERMINÉE !', 'success');
        log('═══════════════════════════════════════');
        log('Reset de l\'ESP32...');

        // Reset hard
        await esploader.hardReset();

        log('');
        log('🎉 Succès total !', 'success');
        log('L\'ESP32 redémarre avec le nouveau firmware');
        log('Vous pouvez maintenant débrancher l\'ESP32');
        log('');

      } catch (error) {
        log('');
        log('═══════════════════════════════════════');
        log('❌ ERREUR DE PROGRAMMATION', 'error');
        log('═══════════════════════════════════════');
        log('Erreur: ' + error.message, 'error');
        log('');
        
        // Messages d'aide selon le type d'erreur
        if (error.message.includes('HTTP 404')) {
          log('💡 Vérifiez que les fichiers .bin existent dans le dossier firmwares/', 'warning');
        } else if (error.message.includes('timeout')) {
          log('💡 Essayez de débrancher et rebrancher l\'ESP32', 'warning');
        }
        
        console.error(error);
      } finally {
        // Réactiver les boutons
        programButton.disabled = false;
        eraseButton.disabled = false;
        connectButton.disabled = false;
      }
    });
  }

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

      // Désactiver les boutons
      programButton.disabled = true;
      eraseButton.disabled = true;
      connectButton.disabled = true;

      try {
        log('═══════════════════════════════════════');
        log('🗑️  EFFACEMENT DE LA FLASH');
        log('═══════════════════════════════════════');
        log('⚠️  NE DÉBRANCHEZ PAS L\'ESP32 !', 'warning');
        log('Cela peut prendre jusqu\'à 30 secondes...');
        log('');

        await esploader.eraseFlash();

        log('');
        log('═══════════════════════════════════════');
        log('✅ FLASH EFFACÉE AVEC SUCCÈS !', 'success');
        log('═══════════════════════════════════════');
        log('L\'ESP32 est maintenant vierge');
        log('Vous pouvez flasher un nouveau firmware');
        log('');

      } catch (error) {
        log('');
        log('═══════════════════════════════════════');
        log('❌ ERREUR D\'EFFACEMENT', 'error');
        log('═══════════════════════════════════════');
        log('Erreur: ' + error.message, 'error');
        console.error(error);
      } finally {
        // Réactiver les boutons
        programButton.disabled = false;
        eraseButton.disabled = false;
        connectButton.disabled = false;
      }
    });
  }

  console.log('Initialisation terminée ✓');
}
