/** Reads a user-picked file and parses it as JSON. Rejects on a read or parse error. */
export function readJsonFile(file: Blob): Promise<unknown> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(reader.error ?? new Error("File read failed"));
        reader.onload = () => {
            try {
                resolve(JSON.parse(reader.result as string));
            } catch (error) {
                reject(error);
            }
        };
        reader.readAsText(file);
    });
}
