// src/lib/utils/formatters.ts

export function formatDate(timestamp: string | null): string {
    if (!timestamp) return 'N/A';
    return new Date(timestamp).toLocaleString();
}

export function formatDuration(seconds: number | null | undefined): string {
    if (seconds === null || seconds === undefined) return 'N/A';
    // Ensures the output is always HH:MM:SS format
    return new Date(seconds * 1000).toISOString().slice(11, 19);
}

export function timecodeToSeconds(timecode: string): number {
    try {
        const parts = timecode.split(':').map(parseFloat);
        if (parts.length === 3) {
            return parts[0] * 3600 + parts[1] * 60 + parts[2];
        }
        // Add more parsing logic here if you have different timecode formats
        console.warn('Could not parse timecode:', timecode);
        return 0;
    } catch (e) {
        console.error('Invalid timecode format:', timecode);
        return 0;
    }
}

export function formatBytes(bytes: number | null | undefined, decimals = 2): string {
    if (bytes === null || bytes === undefined || bytes === 0) return '0 Bytes';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}