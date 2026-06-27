import { validateUser } from '../auth';

interface LoginProps {
    onSuccess: () => void;
}

export function LoginForm({ onSuccess }: LoginProps) {
    const handleSubmit = (email: string, password: string) => {
        if (validateUser(email, password)) {
            onSuccess();
        }
    };

    return null;
}
