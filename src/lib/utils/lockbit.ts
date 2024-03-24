import * as crypto from 'crypto';
import * as fs from 'fs';
import yaml from 'yaml';

export class LockBit {
    _algorithm: string;
    _key: Buffer;
    _iv: Buffer;
    _raw_strct: object[];
    _file_path: string;

    constructor(key: string, iv: string) {
        this._algorithm = 'aes-256-cbc';
        // this._key = crypto.randomBytes(32);
        console.log(crypto.randomBytes(32));
        console.log(Buffer.from(key, 'utf-8'))
        this._iv = crypto.createHash('sha256').update(iv).digest().subarray(0, 16);
        this._key = crypto.createHash('sha256').update(key).digest();
        this._file_path = 'encrypted_blog_cfg.json';
        this._raw_strct = [];
    }

    loadYaml() {
        try {
            const file = fs.readFileSync(this._file_path, 'utf8');
            this._raw_strct = JSON.parse(file);
        }
        catch (e) {
            console.log(e);
        }
    }

    store() {
        try {
            const raw = JSON.stringify(this._raw_strct, null, "\t");
            fs.writeFileSync(this._file_path, raw);
        }
        catch (e) {
            console.log(e);
        }
    }

    appendYaml(key: string, child: any) {
        this._raw_strct.push({[key]: child});
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

    as_strct(slug: string, title: string): object {
        return {
            slug: slug,
            title: title,
            key: this._key,
            iv: this._iv,
        }
    }
};
