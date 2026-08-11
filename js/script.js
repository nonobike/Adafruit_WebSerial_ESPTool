console.log('Script chargé - ESPTool-JS v0.5.6 (avec gestion améliorée du reset)');

document.addEventListener('DOMContentLoaded', function() {
  let port = null;
  let isConnected = false;
  let esploader = null;
  let transport = null;
  let chip = null;

  const connectButton = document.getElementById('butConnect');
  const baudRateSelect = document.getElementById('baudRate');
  const firmwarePicker = document.getElementById('firmware-picker');
  const programButton = document.getElementById('programButton');
  const eraseButton = document.getElementById('eraseButton');
  const consoleElement = document.getElementById('console');

  if (!("serial" in navigator)) {
    console.error('WebSerial non supporté');
    const notSupported = document.getElementById("notSupported");
    if (notSupported) notSupported.style.display = "block";
    return;
  } else {
    const notSupported = document.getElementById("notSupported");
    if (notSupported) notSupported.style.display = "none";
  }

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
    if (type === 'error') console.error(message);
    else console.log(logMessage);
  }

  const espLoaderTerminal = {
    clean() { if (consoleElement) consoleElement.textContent = ''; },
    writeLine(data) { log(data); },
    write(data) {
      if (consoleElement) {
        consoleElement.textContent += data;
        consoleElement.scrollTop = consoleElement.scrollHeight;
      }
    }
  };

  if (baudRateSelect) {
    const baudRates = [9600, 57600, 115200, 230400, 460800, 921600];
    baudRates.forEach(rate => {
      const option = document.createElement('option');
      option.value = rate;
      option.textContent = `${rate} baud`;
      if (rate === 115200) option.selected = true;
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
      if (firmwareInfo) firmwareInfo.style.display = 'block';
      if (firmwareDescription) firmwareDescription.innerHTML = `<strong>${firmware.name}</strong><br>Version: ${firmware.version}`;
    } else {
      if (firmwareInfo) firmwareInfo.style.display = 'none';
    }
  }

  updateFirmwareInfo();
  if (firmwarePicker) firmwarePicker.addEventListener('change', updateFirmwareInfo);

  async function loadBinaryFile(filepath) {
    try {
      log(`Téléchargement: ${filepath}...`);
      const response = await fetch(filepath);
      if (!response.ok) throw new Error(`Fichier introuvable: ${filepath}`);
      const arrayBuffer = await response.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      if (uint8Array.length === 0) throw new Error(`Fichier vide: ${filepath}`);
      log(`✓ ${filepath} chargé (${uint8Array.length} octets)`, 'success');
      return uint8Array;
    } catch (error) {
      log(`Erreur de chargement: ${error.message}`, 'error');
      throw error;
    }
  }

  if (connectButton) {
    connectButton.addEventListener('click', async function() {
      if (!isConnected) {
        try {
          if (typeof esptool === 'undefined') throw new Error('esptool-js n\'est pas chargé. Vérifiez le CDN ou votre connexion internet.');
          port = await navigator.serial.requestPort();
          const baudRate = baudRateSelect ? parseInt(baudRateSelect.value) : 115200;
          log(`Connexion en cours à ${baudRate} baud...`);
          transport = new window.esptool.Transport(port, true);
          esploader = new window.esptool.ESPLoader({
            transport: transport,
            baudrate: baudRate,
            terminal: espLoaderTerminal
          });
          log('Détection du chip ESP...');
          chip = await esploader.main();
          isConnected = true;
          connectButton.textContent = 'Déconnecter';
          connectButton.style.backgroundColor = '#c64141';
          connectButton.style.borderColor = '#900';
          if (programButton) programButton.disabled = false;
          if (eraseButton) eraseButton.disabled = false;
          log(`CONNECTÉ AVEC SUCCÈS`, 'success');
          log(`Chip: ${chip}`, 'success');
        } catch (error) {
          log(`Erreur de connexion: ${error.message}`, 'error');
          console.error(error);
          isConnected = false;
          if (error.message.includes('esptool')) log('💡 Vérifiez votre connexion internet (CDN esptool-js)', 'warning');
          else if (error.message.includes('Failed to open')) log('💡 Fermez Arduino IDE / PlatformIO / moniteurs série', 'warning');
        }
      } else {
        try {
          log('Déconnexion...');
          if (esploader) {
            // Ajout d'un délai avant le reset
            await esploader.hardReset();
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
          if (transport) await transport.disconnect();
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
    programButton.disabled = true;
    eraseButton.disabled = true;
    connectButton.disabled = true;
    try {
      log('🚀 DÉBUT DE LA PROGRAMMATION');
      log(`Firmware: ${firmware.name} v${firmware.version}`);
      if (!firmware.builds || !firmware.builds[0] || !firmware.builds[0].parts) throw new Error('Configuration du firmware invalide');
      const parts = firmware.builds[0].parts;
      log(`Fichiers à flasher: ${parts.length}`);
      const fileArray = [];
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        log(`[${i + 1}/${parts.length}] Préparation de ${part.path}...`);
        const data = await loadBinaryFile(part.path);
        if (!(data instanceof Uint8Array)) throw new Error(`Format de données invalide pour ${part.path}`);
        let binaryString = '';
        for (let j = 0; j < data.length; j++) binaryString += String.fromCharCode(data[j]);
        fileArray.push({ data: binaryString, address: part.offset });
      }
      log('Tous les fichiers sont chargés ✓', 'success');
      log('📝 Écriture de la flash...');
      log('NE DÉBRANCHEZ PAS L\'ESP32 !', 'warning');
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
        },
        calculateMD5Hash: (image) => {
          const wordArray = CryptoJS.enc.Latin1.parse(image);
          return CryptoJS.MD5(wordArray);
        }
      };
      await esploader.writeFlash(flashOptions);
      log('PROGRAMMATION TERMINÉE !', 'success');
      log('Reset de l\'ESP32...');
      // Reset géré nativement par esptool-js
      try {
        await esploader.after("hard_reset");
        await new Promise(resolve => setTimeout(resolve, 1000));
        log('ESP32 redémarré avec le nouveau firmware', 'success');
      } catch (error) {
        log(`Erreur lors du reset: ${error.message}`, 'error');
        if (port) {
          try {
            await port.setSignals({ dataTerminalReady: false, requestToSend: false });
            await new Promise(resolve => setTimeout(resolve, 100));
            await port.setSignals({ dataTerminalReady: true, requestToSend: true });
            log('Reset manuel effectué', 'warning');
          } catch (e) {
            log(`Erreur lors du reset manuel: ${e.message}`, 'error');
          }
        }
      }
      log('Vous pouvez débrancher l\'ESP32', 'success');
    } catch (error) {
      log('ERREUR DE PROGRAMMATION', 'error');
      log(`Erreur: ${error.message}`, 'error');
      console.error(error);
    } finally {
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
      const confirmed = confirm('⚠️ ATTENTION ⚠️\n\nVoulez-vous vraiment effacer TOUTE la mémoire flash de l\'ESP32 ?\n\nCette action est IRRÉVERSIBLE !');
      if (!confirmed) {
        log('Effacement annulé');
        return;
      }
      programButton.disabled = true;
      eraseButton.disabled = true;
      connectButton.disabled = true;
      try {
        log('🗑️  EFFACEMENT DE LA FLASH');
        log('NE DÉBRANCHEZ PAS L\'ESP32 !', 'warning');
        await esploader.eraseFlash();
        log('FLASH EFFACÉE AVEC SUCCÈS !', 'success');
        log('L\'ESP32 est maintenant vierge');
      } catch (error) {
        log('ERREUR D\'EFFACEMENT', 'error');
        log(`Erreur: ${error.message}`, 'error');
        console.error(error);
      } finally {
        programButton.disabled = false;
        eraseButton.disabled = false;
        connectButton.disabled = false;
      }
    });
  }

  log('Connectez votre carte - 0.5.6');
});
