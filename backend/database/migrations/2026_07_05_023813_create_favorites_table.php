<?php

use App\Enums\TitleType;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('favorites', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('title_name');
            $table->enum('title_type', TitleType::values());
            $table->string('genres')->nullable();
            $table->smallInteger('release_year');
            $table->timestamp('added_at')->useCurrent();

            $table->unique(['user_id', 'title_name']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('favorites');
    }
};
