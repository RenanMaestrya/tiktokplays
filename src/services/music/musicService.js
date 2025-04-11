const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const os = require('os');

class MusicService {
    constructor() {
        this.musicFiles = [];
        this.currentMusicIndex = 0;
        this.isPlaying = false;
        this.player = null;
        this.playNextTimeout = null;
        this.platform = os.platform();
        // Lista de possíveis caminhos do VLC
        this.possibleVlcPaths = [
            'C:\\Program Files\\VideoLAN\\VLC\\vlc.exe',
            'C:\\ProgramFiles\\VideoLAN\\VLC\\vlc.exe'
        ];
        this.vlcPath = null;
    }

    async initialize() {
        try {
            // Verifica se o VLC está instalado no Windows
            if (this.platform === 'win32') {
                // Procura o VLC em todos os caminhos possíveis
                for (const path of this.possibleVlcPaths) {
                    if (fs.existsSync(path)) {
                        this.vlcPath = path;
                        break;
                    }
                }

                if (!this.vlcPath) {
                    console.error('\n=== ATENÇÃO ===');
                    console.error('VLC Media Player não encontrado!');
                    console.error('Para que a música funcione no Windows, você precisa:');
                    console.error('1. Baixar e instalar o VLC Media Player: https://www.videolan.org/vlc/');
                    console.error('2. Instalar na pasta padrão do VLC');
                    console.error('3. Reiniciar o aplicativo após a instalação');
                    console.error('================\n');
                    return;
                }
            }

            const soundsDir = path.join(__dirname, '../../../sounds');
            this.musicFiles = fs.readdirSync(soundsDir)
                .filter(file => file.endsWith('.mp3'))
                .map(file => path.join(soundsDir, file));

            if (this.musicFiles.length === 0) {
                console.log('Nenhum arquivo de música encontrado na pasta sounds');
                return;
            }

            // Embaralha as músicas
            this.shuffleMusic();
            console.log(`${this.musicFiles.length} músicas carregadas com sucesso`);
        } catch (error) {
            console.error('Erro ao inicializar serviço de música:', error);
        }
    }

    shuffleMusic() {
        for (let i = this.musicFiles.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.musicFiles[i], this.musicFiles[j]] = [this.musicFiles[j], this.musicFiles[i]];
        }
    }

    playNext() {
        if (this.musicFiles.length === 0) return;

        if (this.currentMusicIndex >= this.musicFiles.length) {
            this.currentMusicIndex = 0;
            this.shuffleMusic();
        }

        const musicFile = this.musicFiles[this.currentMusicIndex];
        console.log(`Tocando: ${path.basename(musicFile)}`);

        // Limpa qualquer timeout existente
        if (this.playNextTimeout) {
            clearTimeout(this.playNextTimeout);
        }

        let command;
        if (this.platform === 'darwin') { // macOS
            command = `afplay -v 0.3 "${musicFile}"`;
        } else if (this.platform === 'win32') { // Windows
            if (!this.vlcPath) {
                console.error('VLC não encontrado. Por favor, instale o VLC Media Player.');
                return;
            }
            // Usa o VLC com volume em 30% e modo headless
            command = `"${this.vlcPath}" "${musicFile}" --volume 30 --play-and-exit --qt-start-minimized`;
        } else {
            console.error('Sistema operacional não suportado');
            return;
        }

        this.player = exec(command, (error) => {
            if (error) {
                console.error('Erro ao reproduzir música:', error);
            }
            this.currentMusicIndex++;
            // Usa setTimeout para evitar recursão
            this.playNextTimeout = setTimeout(() => this.playNext(), 1000);
        });

        this.isPlaying = true;
    }

    start() {
        if (!this.isPlaying) {
            this.playNext();
        }
    }

    stop() {
        if (this.playNextTimeout) {
            clearTimeout(this.playNextTimeout);
            this.playNextTimeout = null;
        }
        if (this.player) {
            this.player.kill();
            this.player = null;
        }
        this.isPlaying = false;
    }
}

module.exports = new MusicService(); 