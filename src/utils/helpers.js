const fs = require('fs');

// Função para esperar um tempo específico
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Função para obter o último arquivo de backup
function obterUltimoBackup() {
    try {
        if (!fs.existsSync('backups')) {
            return null;
        }
        
        const arquivos = fs.readdirSync('backups');
        if (arquivos.length === 0) {
            return null;
        }
        
        return arquivos
            .map(arquivo => ({
                nome: arquivo,
                data: fs.statSync(`backups/${arquivo}`).mtime
            }))
            .sort((a, b) => b.data - a.data)[0].nome;
    } catch (err) {
        console.error('Erro ao obter último backup:', err);
        return null;
    }
}

module.exports = {
    delay,
    obterUltimoBackup
}; 