<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\Exceptions\HttpResponseException;
use Override;

class SearchRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, array<int, string>>
     */
    public function rules(): array
    {
        return [
            'q' => ['required', 'string', 'min:2'],
            'limit' => ['sometimes', 'integer', 'min:1', 'max:20'],
        ];
    }

    /**
     * Match the exact error contract for this endpoint
     * (docs/features/feature-search-discovery/02_api_contracts/03_Endpoint_Autocomplete.png).
     */
    #[Override]
    protected function failedValidation(Validator $validator): void
    {
        throw new HttpResponseException(response()->json([
            'status' => 'error',
            'message' => 'Enter at least 2 characters',
        ], 422));
    }
}
