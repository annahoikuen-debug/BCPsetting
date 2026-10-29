'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface APIKeyContextType {
    apiKey: string | null;
    setApiKey: (key: string | null) => void;
    isApiKeySet: boolean;
}

const APIKeyContext = createContext<APIKeyContextType | undefined>(undefined);

export const APIKeyProvider = ({ children }: { children: ReactNode }) => {
    const [apiKey, setApiKeyState] = useState<string | null>(null);

    useEffect(() => {
        // Load API key from session storage on mount.
        // sessionStorage はタブ/ウィンドウを閉じると自動消去されるため、
        // localStorage より XSS による長期的なキー窃取リスクが低い。
        const savedKey = sessionStorage.getItem('app_api_key');
        if (savedKey) {
            setApiKeyState(savedKey);
        }
    }, []);

    const setApiKey = (key: string | null) => {
        setApiKeyState(key);
        if (key) {
            sessionStorage.setItem('app_api_key', key);
        } else {
            sessionStorage.removeItem('app_api_key');
        }
    };

    return (
        <APIKeyContext.Provider value={{ apiKey, setApiKey, isApiKeySet: !!apiKey }}>
            {children}
        </APIKeyContext.Provider>
    );
};

export const useAPIKey = () => {
    const context = useContext(APIKeyContext);
    if (context === undefined) {
        throw new Error('useAPIKey must be used within an APIKeyProvider');
    }
    return context;
};
