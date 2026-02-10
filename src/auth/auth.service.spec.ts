import type { User } from "@supabase/supabase-js";
import type { AuthRepositoryPort } from "@/auth/domain/auth.repository";
import type { DomainConfigService } from "@/domain-config/domain-config.service";
import { AuthService } from "./auth.service";

describe("AuthService", () => {
    let service: AuthService;
    let authRepo: jest.Mocked<AuthRepositoryPort>;
    let domainCfg: jest.Mocked<DomainConfigService>;

    const mockUser: Partial<User> = {
        id: "user-123",
        email: "test@example.com",
    };

    beforeEach(() => {
        authRepo = {
            signUp: jest.fn(),
            signIn: jest.fn(),
            signOut: jest.fn(),
            deleteAccount: jest.fn(),
            updateEmail: jest.fn(),
            updateUsername: jest.fn(),
            updatePassword: jest.fn(),
            forgotPassword: jest.fn(),
            resetPassword: jest.fn(),
            verifyEmail: jest.fn(),
            verifyTotp: jest.fn(),
            enrollTotp: jest.fn(),
            disableTotp: jest.fn(),
            refreshAccessToken: jest.fn(),
        } as unknown as jest.Mocked<AuthRepositoryPort>;

        domainCfg = {
            getResetPasswordUrl: jest
                .fn()
                .mockReturnValue("https://app.example.com/reset"),
        } as unknown as jest.Mocked<DomainConfigService>;

        service = new AuthService(authRepo, domainCfg);
    });

    describe("signUp", () => {
        it("delegates to authRepo.signUp", async () => {
            const expected = { user: mockUser, session: {} };
            authRepo.signUp.mockResolvedValue(expected);

            const result = await service.signUp(
                "test@example.com",
                "password123",
                "testuser",
            );

            expect(result).toEqual(expected);
            expect(authRepo.signUp).toHaveBeenCalledWith(
                "test@example.com",
                "password123",
                "testuser",
            );
        });
    });

    describe("signIn", () => {
        it("delegates to authRepo.signIn", async () => {
            const expected = { session: { access_token: "tok" } };
            authRepo.signIn.mockResolvedValue(expected);

            const result = await service.signIn(
                "test@example.com",
                "password123",
            );

            expect(result).toEqual(expected);
            expect(authRepo.signIn).toHaveBeenCalledWith(
                "test@example.com",
                "password123",
            );
        });
    });

    describe("signOut", () => {
        it("delegates to authRepo.signOut", async () => {
            authRepo.signOut.mockResolvedValue(undefined);
            await service.signOut();
            expect(authRepo.signOut).toHaveBeenCalledTimes(1);
        });
    });

    describe("deleteAccount", () => {
        it("delegates to authRepo.deleteAccount", async () => {
            authRepo.deleteAccount.mockResolvedValue(undefined);
            await service.deleteAccount("user-123");
            expect(authRepo.deleteAccount).toHaveBeenCalledWith("user-123");
        });
    });

    describe("updateEmail", () => {
        it("passes user.id and new email to repo", async () => {
            authRepo.updateEmail.mockResolvedValue(undefined);

            await service.updateEmail(mockUser as User, "new@example.com");

            expect(authRepo.updateEmail).toHaveBeenCalledWith(
                "user-123",
                "new@example.com",
            );
        });
    });

    describe("updateUsername", () => {
        it("passes user.id and new username to repo", async () => {
            authRepo.updateUsername.mockResolvedValue(undefined);

            await service.updateUsername(mockUser as User, "newname");

            expect(authRepo.updateUsername).toHaveBeenCalledWith(
                "user-123",
                "newname",
            );
        });
    });

    describe("updatePassword", () => {
        it("passes user.id, email, old and new passwords to repo", async () => {
            authRepo.updatePassword.mockResolvedValue(undefined);

            await service.updatePassword(mockUser as User, "oldpw", "newpw");

            expect(authRepo.updatePassword).toHaveBeenCalledWith(
                "user-123",
                "test@example.com",
                "oldpw",
                "newpw",
            );
        });

        it("uses empty string if user email is undefined", async () => {
            const noEmailUser = { id: "user-123" } as User;
            authRepo.updatePassword.mockResolvedValue(undefined);

            await service.updatePassword(noEmailUser, "old", "new");

            expect(authRepo.updatePassword).toHaveBeenCalledWith(
                "user-123",
                "",
                "old",
                "new",
            );
        });
    });

    describe("forgotPassword", () => {
        it("passes email and reset URL from domainCfg", async () => {
            authRepo.forgotPassword.mockResolvedValue(undefined);

            await service.forgotPassword("test@example.com");

            expect(authRepo.forgotPassword).toHaveBeenCalledWith(
                "test@example.com",
                "https://app.example.com/reset",
            );
            expect(domainCfg.getResetPasswordUrl).toHaveBeenCalledTimes(1);
        });
    });

    describe("resetPassword", () => {
        it("delegates to authRepo.resetPassword", async () => {
            authRepo.resetPassword.mockResolvedValue(undefined);
            await service.resetPassword("token-abc", "newpw");
            expect(authRepo.resetPassword).toHaveBeenCalledWith(
                "token-abc",
                "newpw",
            );
        });
    });

    describe("verifyEmail", () => {
        it("delegates to authRepo.verifyEmail", async () => {
            authRepo.verifyEmail.mockResolvedValue(undefined);
            await service.verifyEmail("test@example.com", "tok123");
            expect(authRepo.verifyEmail).toHaveBeenCalledWith(
                "test@example.com",
                "tok123",
            );
        });
    });

    describe("TOTP", () => {
        it("enrollTotp delegates", async () => {
            authRepo.enrollTotp.mockResolvedValue({
                id: "f1",
                otpauthUri: "otpauth://...",
            });
            const result = await service.enrollTotp("My Phone");
            expect(result).toEqual({ id: "f1", otpauthUri: "otpauth://..." });
            expect(authRepo.enrollTotp).toHaveBeenCalledWith("My Phone");
        });

        it("verifyTotp delegates", async () => {
            authRepo.verifyTotp.mockResolvedValue(undefined);
            await service.verifyTotp("f1", "123456");
            expect(authRepo.verifyTotp).toHaveBeenCalledWith("f1", "123456");
        });

        it("disableTotp delegates", async () => {
            authRepo.disableTotp.mockResolvedValue(undefined);
            await service.disableTotp("f1");
            expect(authRepo.disableTotp).toHaveBeenCalledWith("f1");
        });
    });

    describe("refreshAccessToken", () => {
        it("delegates to authRepo", async () => {
            authRepo.refreshAccessToken.mockResolvedValue({
                access_token: "new",
            });
            const result = await service.refreshAccessToken("refresh-tok");
            expect(result).toEqual({ access_token: "new" });
        });
    });
});
