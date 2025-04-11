const fs = require('fs');
const { delay } = require('../../utils/helpers');
const { MAX_RETRIES } = require('../../config/constants');

let isBackupInProgress = false;
let page = null;
let backupTimeout = null;
let lastBackupTime = null;

function setPage(newPage) {
    page = newPage;
}

// Função para agendar o próximo backup
function agendarProximoBackup() {
    // Limpa qualquer timeout existente
    if (backupTimeout) {
        clearTimeout(backupTimeout);
    }
    
    // Calcula o tempo até o próximo backup (1 hora)
    const umaHora = 3600000; // 1 hora em milissegundos
    const tempoAteProximoBackup = umaHora - (Date.now() - lastBackupTime);
    
    // Se já passou mais de 1 hora desde o último backup, faz o backup imediatamente
    if (tempoAteProximoBackup <= 0) {
        fazerBackupAutomatico();
        return;
    }
    
    // Agenda o próximo backup
    backupTimeout = setTimeout(() => {
        fazerBackupAutomatico();
    }, tempoAteProximoBackup);
    
    console.log(`Próximo backup agendado para daqui ${Math.round(tempoAteProximoBackup/1000/60)} minutos`);
}

// Função para fazer backup automático
async function fazerBackupAutomatico() {
    if (isBackupInProgress) {
        console.log('Backup já está em andamento, aguardando...');
        return;
    }
    
    try {
        await fazerBackup();
        lastBackupTime = Date.now();
        agendarProximoBackup();
    } catch (err) {
        console.error('Erro no backup automático:', err);
        // Tenta novamente em 5 minutos se falhar
        setTimeout(fazerBackupAutomatico, 300000);
    }
}

// Função para iniciar o backup automático
function iniciarBackupAutomatico() {
    lastBackupTime = Date.now();
    agendarProximoBackup();
    console.log('Backup automático configurado para executar a cada hora');
}

// Função para parar o backup automático
function pararBackupAutomatico() {
    if (backupTimeout) {
        clearTimeout(backupTimeout);
        backupTimeout = null;
        console.log('Backup automático desativado');
    }
}

// Função para clicar no cookie de forma visível
async function clicarCookie(vezes) {
    if (isBackupInProgress) {
        console.log('Backup em andamento, pulando cliques...');
        return;
    }
    
    try {
        const cookie = await page.$('#bigCookie');
        if (cookie) {
            for (let i = 0; i < vezes; i++) {
                if (isBackupInProgress) break;
                await cookie.click();
                await new Promise(resolve => setTimeout(resolve, 10));
            }
        }
    } catch (err) {
        console.error('Erro ao clicar no cookie:', err);
    }
}

// Função para fazer backup do salvamento
async function fazerBackup() {
    if (isBackupInProgress) {
        console.log('Backup já está em andamento, aguardando...');
        return;
    }
    
    isBackupInProgress = true;
    console.log('Iniciando backup do salvamento...');
    
    for (let retry = 0; retry < MAX_RETRIES; retry++) {
        try {
            console.log(`Tentativa ${retry + 1} de fazer backup...`);
            
            await page.waitForSelector('.subButton', { visible: true, timeout: 30000 });
            await page.click('.subButton');
            await page.waitForSelector('.option.smallFancyButton', { visible: true, timeout: 30000 });
            await page.click('a.option.smallFancyButton[onclick*="ExportSave"]');
            await page.waitForSelector('#textareaPrompt', { visible: true, timeout: 30000 });
            await delay(2000);
            
            const saveData = await page.$eval('#textareaPrompt', el => el.value);
            
            if (!saveData) {
                throw new Error('Dados de salvamento vazios');
            }
            
            if (!fs.existsSync('backups')) {
                fs.mkdirSync('backups');
            }
            
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const fileName = `backups/save_${timestamp}.txt`;
            
            fs.writeFileSync(fileName, saveData);
            console.log(`Backup salvo com sucesso em: ${fileName}`);
            
            try {
                await page.keyboard.press('Escape');
            } catch (err) {
                console.log('Tentando fechar diálogo de outra forma...');
                try {
                    await page.click('#promptOption0');
                } catch (err) {
                    console.log('Não foi possível fechar o diálogo, continuando...');
                }
            }
            
            isBackupInProgress = false;
            return;
            
        } catch (err) {
            console.error(`Tentativa ${retry + 1} de backup falhou:`, err.message);
            if (retry === MAX_RETRIES - 1) {
                console.log('Número máximo de tentativas atingido. Pulando backup...');
                isBackupInProgress = false;
                return;
            }
            await delay(5000);
        }
    }
}

// Função para comprar upgrade
async function comprarUpgrade(nomeUpgrade) {
    if (isBackupInProgress) {
        console.log('Backup em andamento, pulando compra...');
        return;
    }
    
    try {
        if (!nomeUpgrade) return;
        
        if (nomeUpgrade.toLowerCase() === 'up') {
            const upgrades = await page.$$('.crate.upgrade.enabled');
            if (upgrades.length > 0) {
                await upgrades[0].click();
                console.log('Primeiro upgrade disponível comprado com sucesso!');
                return;
            }
            return;
        }
        
        const upgradeMatch = nomeUpgrade.match(/^up(\d+)$/i);
        if (upgradeMatch) {
            const upgradeIndex = parseInt(upgradeMatch[1]) - 1;
            const upgrades = await page.$$('.crate.upgrade.enabled');
            
            if (upgrades[upgradeIndex]) {
                await upgrades[upgradeIndex].click();
                console.log(`Upgrade ${upgradeIndex + 1} comprado com sucesso!`);
                return;
            }
            return;
        }
        
        const produtos = await page.$$('.product.unlocked.enabled');
        for (const produto of produtos) {
            const nome = await produto.$eval('.productName', el => el.textContent.trim());
            if (nome.toLowerCase() === nomeUpgrade.toLowerCase()) {
                await produto.click();
                console.log(`Produto ${nomeUpgrade} comprado com sucesso!`);
                return;
            }
        }
        
    } catch (err) {
        console.error('Erro ao comprar upgrade:', err.message);
    }
}

module.exports = {
    setPage,
    clicarCookie,
    fazerBackup,
    comprarUpgrade,
    iniciarBackupAutomatico,
    pararBackupAutomatico
}; 