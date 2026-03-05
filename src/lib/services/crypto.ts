const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12;
const SALT_LENGTH = 16;
const ITERATIONS = 100000;

export interface EncryptedData {
	salt: number[];
	iv: number[];
	data: number[];
}

async function generateKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
	const encoder = new TextEncoder();
	const keyMaterial = await crypto.subtle.importKey(
		'raw',
		encoder.encode(password),
		'PBKDF2',
		false,
		['deriveKey']
	);

	return crypto.subtle.deriveKey(
		{
			name: 'PBKDF2',
			salt: salt.slice(),
			iterations: ITERATIONS,
			hash: 'SHA-256'
		},
		keyMaterial,
		{ name: ALGORITHM, length: KEY_LENGTH },
		false,
		['encrypt', 'decrypt']
	);
}

export async function encrypt(text: string, password: string): Promise<EncryptedData> {
	const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
	const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
	const key = await generateKey(password, salt);

	const encoder = new TextEncoder();
	const encrypted = await crypto.subtle.encrypt(
		{ name: ALGORITHM, iv, tagLength: 128 },
		key,
		encoder.encode(text)
	);

	return {
		salt: Array.from(salt),
		iv: Array.from(iv),
		data: Array.from(new Uint8Array(encrypted))
	};
}

export async function decrypt(encryptedData: EncryptedData, password: string): Promise<string> {
	const salt = new Uint8Array(encryptedData.salt);
	const iv = new Uint8Array(encryptedData.iv);
	const data = new Uint8Array(encryptedData.data);

	const key = await generateKey(password, salt);

	const decrypted = await crypto.subtle.decrypt(
		{ name: ALGORITHM, iv, tagLength: 128 },
		key,
		data
	);

	return new TextDecoder().decode(decrypted);
}
