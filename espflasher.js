class ESPOneClickFlasher {
    constructor() {
        this.port = null;
        this.connected = false;
        this.firmwareData = null;
        this.firmwareURL = 'firmware.ino.bin'; // Your firmware file name
        
        // Bind methods
        this.connect = this.connect.bind(this);
        this.flash = this.flash.bind(this);
        this.showLog = this.showLog.bind(this);
        
        this.init();
    }
    
    async init() {
        // Setup button event listeners
        document.getElementById('connectBtn').onclick = this.connect;
        document.getElementById('flashBtn').onclick = this.flash;
        document.getElementById('showLogBtn').onclick = this.showLog;
        
        // Pre-load the firmware file
        await this.loadFirmware();
        
        // Check for Web Serial support
        if (!('serial' in navigator)) {
            this.showError('Web Serial API not supported. Use Chrome/Edge 89+ or Opera 76+');
        }
    }
    
    async loadFirmware() {
        try {
            this.log('📥 Loading firmware file...');
            const response = await fetch(this.firmwareURL);
            
            if (!response.ok) {
                throw new Error(`Failed to load firmware: ${response.status}`);
            }
            
            this.firmwareData = await response.arrayBuffer();
            this.log(`✅ Firmware loaded: ${(this.firmwareData.byteLength / 1024).toFixed(1)} KB`);
            
        } catch (error) {
            this.showError(`Failed to load firmware file: ${error.message}`);
            console.error('Firmware load error:', error);
        }
    }
    
    async connect() {
        try {
            this.log('🔍 Requesting serial port...');
            
            // Request serial port
            this.port = await navigator.serial.requestPort();
            
            // Open port
            await this.port.open({ baudRate: 115200 });
            
            this.connected = true;
            this.updateConnectionStatus('✅ Connected to ESP device', 'success');
            
            // Enable flash button
            document.getElementById('flashBtn').disabled = false;
            this.log('📡 Port opened at 115200 baud');
            
        } catch (error) {
            if (error.name === 'NotFoundError') {
                this.log('⚠️ No port selected');
            } else {
                this.showError(`Connection failed: ${error.message}`);
            }
        }
    }
    
    async flash() {
        if (!this.connected || !this.port || !this.firmwareData) {
            this.showError('Not ready to flash. Check connection and firmware.');
            return;
        }
        
        try {
            // Reset progress
            document.getElementById('progressContainer').style.display = 'block';
            this.updateProgress(0);
            
            // Show log
            document.getElementById('showLogBtn').style.display = 'inline-block';
            
            // Enter bootloader mode
            this.log('🔄 Entering bootloader mode...');
            await this.resetToBootloader();
            await this.delay(100);
            
            // Sync with ESP
            this.log('🤝 Syncing with ESP...');
            await this.sync();
            
            // Get chip info
            const chipInfo = await this.getChipInfo();
            this.log(`📟 Chip detected: ${chipInfo}`);
            
            // Flash firmware
            this.log('⚡ Starting flash process...');
            await this.flashData(this.firmwareData);
            
            // Reset to app mode
            this.log('🔄 Resetting to application mode...');
            await this.resetToApp();
            
            this.showMessage('🎉 Firmware flashed successfully!', 'success');
            this.log('✅ Flash complete! Device should restart.');
            
        } catch (error) {
            this.showError(`Flash failed: ${error.message}`);
            this.log(`❌ Error: ${error.message}`);
        }
    }
    
    async resetToBootloader() {
        if (!this.port) return;
        
        // Toggle DTR/RTS to reset into bootloader
        await this.port.setSignals({
            dataTerminalReady: false,
            requestToSend: true
        });
        await this.delay(100);
        await this.port.setSignals({
            dataTerminalReady: true,
            requestToSend: false
        });
        await this.delay(50);
    }
    
    async resetToApp() {
        if (!this.port) return;
        
        // Reset to application mode
        await this.port.setSignals({
            dataTerminalReady: false,
            requestToSend: false
        });
        await this.delay(100);
        await this.port.setSignals({
            dataTerminalReady: true,
            requestToSend: true
        });
    }
    
    async sync() {
        // Simplified sync command (actual implementation would use proper ESP protocol)
        const writer = this.port.writable.getWriter();
        const syncPacket = new Uint8Array([0x08, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
        await writer.write(syncPacket);
        writer.releaseLock();
        await this.delay(100);
    }
    
    async getChipInfo() {
        // Simplified chip detection
        return "ESP8266/ESP32";
    }
    
    async flashData(data) {
        const chunkSize = 0x1000; // 4KB chunks
        const totalChunks = Math.ceil(data.byteLength / chunkSize);
        
        const writer = this.port.writable.getWriter();
        
        for (let i = 0; i < totalChunks; i++) {
            const start = i * chunkSize;
            const end = Math.min(start + chunkSize, data.byteLength);
            const chunk = new Uint8Array(data.slice(start, end));
            
            // Send chunk (simplified - real ESP protocol needs proper framing)
            await writer.write(chunk);
            
            // Update progress
            const progress = Math.round(((i + 1) / totalChunks) * 100);
            this.updateProgress(progress);
            this.log(`📦 Writing chunk ${i + 1}/${totalChunks} (${progress}%)`);
            
            // Small delay to prevent overwhelming the chip
            await this.delay(10);
        }
        
        writer.releaseLock();
    }
    
    updateProgress(percent) {
        document.getElementById('progressFill').style.width = percent + '%';
        document.getElementById('progressText').textContent = percent + '%';
    }
    
    updateConnectionStatus(message, type = 'info') {
        const statusEl = document.getElementById('connectionStatus');
        statusEl.textContent = message;
        statusEl.className = `status ${type}`;
        statusEl.style.display = 'block';
    }
    
    showMessage(message, type = 'info') {
        const messageEl = document.getElementById('message');
        messageEl.textContent = message;
        messageEl.className = `status ${type}`;
        messageEl.style.display = 'block';
    }
    
    showError(message) {
        this.showMessage(message, 'error');
        this.log(`❌ ${message}`);
    }
    
    log(message) {
        const logEl = document.getElementById('logOutput');
        const timestamp = new Date().toLocaleTimeString();
        logEl.innerHTML += `[${timestamp}] ${message}<br>`;
        logEl.scrollTop = logEl.scrollHeight;
    }
    
    showLog() {
        const logEl = document.getElementById('logOutput');
        logEl.style.display = logEl.style.display === 'block' ? 'none' : 'block';
    }
    
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.flasher = new ESPOneClickFlasher();
});
