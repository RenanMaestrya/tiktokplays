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

function getPage() {
    return page;
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
    console.log('Iniciando backup do salvamento...');
    const page = getPage();
    
    if (!page) {
        console.log('Página não encontrada, não é possível fazer backup');
        return;
    }

    for (let tentativa = 1; tentativa <= 3; tentativa++) {
        try {
            console.log(`Tentativa ${tentativa} de fazer backup...`);
            
            // Verifica se a página ainda está conectada
            if (!page.isClosed()) {
                // Recarrega a página para garantir que está atualizada
                await page.reload({ waitUntil: 'networkidle0' });
                
                // Espera o jogo carregar completamente
                await page.waitForSelector('.subButton', { visible: true, timeout: 10000 });
                await page.click('.subButton');
                
                // Espera o menu de opções aparecer
                await page.waitForSelector('a.option.smallFancyButton', { visible: true, timeout: 10000 });
                
                // Clica no botão de exportar
                const exportButton = await page.$('a.option.smallFancyButton[onclick*="ExportSave"]');
                if (!exportButton) {
                    throw new Error('Botão de exportar não encontrado');
                }
                await exportButton.click();
                
                // Espera o prompt aparecer
                await page.waitForSelector('#prompt', { visible: true, timeout: 10000 });
                
                // Obtém o texto do save
                const saveData = await page.evaluate(() => {
                    const textarea = document.querySelector('#promptContent');
                    return textarea ? textarea.textContent : null;
                });
                
                if (!saveData) {
                    throw new Error('Não foi possível obter os dados do save');
                }
                
                // Cria o diretório de backups se não existir
                if (!fs.existsSync('backups')) {
                    fs.mkdirSync('backups');
                }
                
                // Salva o arquivo
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const backupPath = `backups/save_${timestamp}.txt`;
                fs.writeFileSync(backupPath, saveData);
                
                console.log(`Backup salvo com sucesso em: ${backupPath}`);
                
                // Tenta fechar o diálogo
                try {
                    await page.click('#promptOption0');
                } catch (err) {
                    console.log('Não foi possível fechar o diálogo, continuando...');
                }
                
                return;
            } else {
                console.log('Página fechada, não é possível fazer backup');
                return;
            }
        } catch (err) {
            console.log(`Tentativa ${tentativa} de backup falhou:`, err.message);
            if (tentativa === 3) {
                console.log('Não foi possível fazer backup após 3 tentativas');
            } else {
                await delay(2000);
            }
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
    getPage,
    clicarCookie,
    fazerBackup,
    comprarUpgrade,
    iniciarBackupAutomatico,
    pararBackupAutomatico
}; 