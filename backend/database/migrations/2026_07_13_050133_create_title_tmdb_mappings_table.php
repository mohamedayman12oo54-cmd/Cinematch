<?php

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
        Schema::create('title_tmdb_mappings', function (Blueprint $table) {
            $table->id();
            $table->string('title_name')->index();
            $table->smallInteger('release_year')->nullable()->unsigned();
            $table->integer('tmdb_id');
            $table->enum('tmdb_type', ['movie', 'tv']);
            $table->string('poster_path')->nullable();
            $table->string('backdrop_path')->nullable();
            $table->timestamps();

            $table->unique(['title_name', 'release_year']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('title_tmdb_mappings');
    }
};
