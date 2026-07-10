<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

/**
 * Seeds the fixed roster of API/Postman testing users.
 *
 * Every user represents a distinct personalization stage (see
 * docs/testing/TEST_DATASET.md) so the Home feature's stranger / explorer /
 * regular / loyal logic, plus cross-user isolation, can be exercised
 * deterministically. All users share the same password so testers only need
 * to remember one credential.
 */
class UserSeeder extends Seeder
{
    /**
     * Password shared by every seeded testing user.
     */
    public const string TEST_PASSWORD = 'password';

    public function run(): void
    {
        $hashedPassword = Hash::make(self::TEST_PASSWORD);

        foreach (self::users() as $email) {
            User::query()->updateOrCreate(
                ['email' => $email],
                ['password' => $hashedPassword],
            );
        }
    }

    /**
     * @return array<int, string>
     */
    public static function users(): array
    {
        return [
            'user1@example.com', // Fresh User
            'user2@example.com', // Explorer User
            'user3@example.com', // Regular User A
            'user4@example.com', // Regular User B (isolation partner)
            'user5@example.com', // Loyal User
            'user6@example.com', // Heavy User
        ];
    }
}
