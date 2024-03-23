import * as crypto from 'crypto';
import * as fs from 'fs';
import yaml from 'yaml';

class Encrypter {
    _algorithm: string;
    _key: Buffer;
    _iv:Buffer;
    _yml: string;

    constructor() {
        this._algorithm = 'aes-256-cbc';
        this._key = crypto.randomBytes(32);
        this._iv = crypto.randomBytes(16);
        this._yml = "";
    }

    loadYaml(path: string) {
        try {
            const file = fs.readFileSync(path, 'utf8');
            this._yml = yaml.parse(file);
        }
        catch (e) {
            console.log(e);
        }
    }
     
    encrypt(text: string): string {
        const cipher = crypto.createCipheriv(this._algorithm, this._key, this._iv);
        let encrypted = cipher.update(text, 'utf-8', 'hex');
        encrypted += cipher.final('hex');
        return encrypted;
    }

    decrypt(encryptedText: string): string {
        const decipher = crypto.createDecipheriv(this._algorithm, this._key, this._iv);
        let decrypted = decipher.update(encryptedText, 'hex', 'utf-8');
        decrypted += decipher.final('utf-8');
        return decrypted;
    }
};
