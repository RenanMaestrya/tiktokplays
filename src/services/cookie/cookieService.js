const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const { COOKIE_CLICKER_URL, BACKUP_INTERVAL } = require('../../config/constants');
const semaforo = require('../../utils/semaforo');
const { delay } = require('../../utils/helpers');
const { MAX_RETRIES } = require('../../config/constants');

let browser = null;
let page = null;
let ultimoBackup = Date.now();
let isBackupInProgress = false;
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

// Função para fechar o menu de opções
async function fecharMenuOpcoes() {
    try {
        if (!page) {
            console.error('Página não encontrada');
            return;
        }

        // Espera um pouco para garantir que o menu está carregado
        await delay(1000);

        // Tenta fechar o menu de opções
        await page.evaluate(() => {
            const optionsButton = document.querySelector('div.subButton');
            if (optionsButton && optionsButton.textContent.trim() === 'Opções') {
                optionsButton.click();
            }
        });

        // Espera um pouco após tentar fechar o menu
        await delay(1000);
    } catch (err) {
        console.error('Erro ao fechar menu de opções:', err);
    }
}

// Função para verificar se o menu está aberto
async function verificarMenuAberto() {
    return await page.evaluate(() => {
        const menu = document.querySelector('#menu');
        return menu && menu.children.length > 0;
    });
}

// Função interna para fazer backup
async function _fazerBackup(manual = false) {
    try {
        if (!page) {
            throw new Error('Página não encontrada');
        }

        // Espera um pouco para garantir que o jogo está carregado
        await delay(1000);

        // Verifica se o objeto Game está disponível
        const gameDisponivel = await page.evaluate(() => {
            return typeof window.Game !== 'undefined';
        });

        if (!gameDisponivel) {
            throw new Error('Objeto Game não está disponível');
        }

        // Espera mais um pouco para garantir que o jogo está pronto
        await delay(1000);

        // Verifica se o menu já está aberto
        const menuAberto = await verificarMenuAberto();
        
        // Se o menu não estiver aberto, abre ele
        if (!menuAberto) {
            await page.evaluate(() => {
                const optionsButton = document.querySelector('div.subButton');
                if (optionsButton && optionsButton.textContent.trim() === 'Opções') {
                    optionsButton.click();
                }
            });
            // Espera o menu de opções aparecer
            await delay(1000);
        }

        // Clica no botão de exportar
        await page.evaluate(() => {
            const exportButton = document.querySelector('a.option.smallFancyButton[onclick*="ExportSave"]');
            if (exportButton) {
                exportButton.click();
            }
        });

        // Espera o prompt aparecer
        await delay(1000);

        // Obtém o conteúdo do textarea
        const saveData = await page.evaluate(() => {
            const textarea = document.querySelector('#textareaPrompt');
            return textarea ? textarea.value : null;
        });

        if (!saveData) {
            throw new Error('Não foi possível obter os dados do save');
        }

        const backupDir = path.join(__dirname, '../../../backups');
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = path.join(backupDir, `backup_${timestamp}.txt`);

        fs.writeFileSync(backupPath, saveData);
        console.log(`Backup salvo em: ${backupPath}`);
        ultimoBackup = Date.now();

        // Clica no botão "Tudo pronto!"
        await page.evaluate(() => {
            const tudoProntoButton = document.querySelector('a#promptOption0');
            if (tudoProntoButton) {
                tudoProntoButton.click();
            }
        });

        // Espera um pouco após clicar em "Tudo pronto!"
        await delay(1000);

        // Fecha o menu de opções
        await fecharMenuOpcoes();

        if (manual) {
            console.log('Backup manual concluído com sucesso!');
            return true;
        }
    } catch (err) {
        console.error('Erro ao fazer backup:', err);
        if (manual) {
            throw err;
        }
    }
}

// Função para fazer backup automático
async function fazerBackup() {
    return semaforo.executarComPrioridade(() => _fazerBackup(false));
}

// Função para fazer backup manual
async function fazerBackupManual() {
    return semaforo.executarComPrioridade(() => _fazerBackup(true));
}

// Função para clicar no cookie
async function clicarCookie(vezes = 1) {
    return semaforo.executar(async () => {
        try {
            if (!page) {
                console.error('Página não encontrada');
                return;
            }

            await page.evaluate((numClicks) => {
                const bigCookie = document.getElementById('bigCookie');
                if (bigCookie) {
                    for (let i = 0; i < numClicks; i++) {
                        bigCookie.click();
                    }
                }
            }, vezes);

            // Verifica se é hora de fazer backup
            if (Date.now() - ultimoBackup >= BACKUP_INTERVAL) {
                await fazerBackup();
            }
        } catch (err) {
            console.error('Erro ao clicar no cookie:', err);
        }
    });
}

// Função para comprar upgrade
async function comprarUpgrade(upgradeId) {
    return semaforo.executar(async () => {
        try {
            if (!page) {
                console.error('Página não encontrada');
                return;
            }

            await page.evaluate((id) => {
                const upgrade = Game.UpgradesById[id];
                if (upgrade && !upgrade.bought) {
                    Game.Upgrade(id);
                }
            }, upgradeId);

            // Verifica se é hora de fazer backup
            if (Date.now() - ultimoBackup >= BACKUP_INTERVAL) {
                await fazerBackup();
            }
        } catch (err) {
            console.error('Erro ao comprar upgrade:', err);
        }
    });
}

// Função para importar save
async function importarSave(saveData) {
    return semaforo.executarComPrioridade(async () => {
        try {
            if (!page) {
                console.error('Página não encontrada');
                return;
            }

            // Espera um pouco para garantir que o jogo está carregado
            await delay(1000);

            // Verifica se o objeto Game está disponível
            const gameDisponivel = await page.evaluate(() => {
                return typeof window.Game !== 'undefined';
            });

            if (!gameDisponivel) {
                console.error('Objeto Game não está disponível');
                return;
            }

            // Espera mais um pouco para garantir que o jogo está pronto
            await delay(1000);

            // Verifica se o menu já está aberto
            const menuAberto = await verificarMenuAberto();
            
            // Se o menu não estiver aberto, abre ele
            if (!menuAberto) {
                await page.evaluate(() => {
                    const optionsButton = document.querySelector('div.subButton');
                    if (optionsButton && optionsButton.textContent.trim() === 'Opções') {
                        optionsButton.click();
                    }
                });
                // Espera o menu de opções aparecer
                await delay(1000);
            }

            // Importa o save
            await page.evaluate((data) => {
                try {
                    if (Game.ImportSave) {
                        Game.ImportSave(data);
                    }
                } catch (err) {
                    console.error('Erro ao importar save:', err);
                }
            }, saveData);

            // Espera o save ser carregado
            await delay(3000);

            // Clica no botão "Tudo pronto!"
            await page.evaluate(() => {
                const tudoProntoButton = document.querySelector('a#promptOption0');
                if (tudoProntoButton) {
                    tudoProntoButton.click();
                }
            });

            // Espera um pouco após clicar em "Tudo pronto!"
            await delay(2000);

            // Fecha o menu de opções
            await fecharMenuOpcoes();
        } catch (err) {
            console.error('Erro ao importar save:', err);
        }
    });
}

module.exports = {
    setPage,
    getPage,
    clicarCookie,
    fazerBackup,
    fazerBackupManual,
    comprarUpgrade,
    iniciarBackupAutomatico,
    pararBackupAutomatico,
    importarSave
}; 