package handler

import (
	"errors"
	"net/http"

	"github.com/joao-moreira/doctor-tracker/internal/adapter/http/dto"
	"github.com/joao-moreira/doctor-tracker/internal/adapter/http/middleware"
	"github.com/joao-moreira/doctor-tracker/internal/domain/auth"
)

type AuthHandler struct {
	service *auth.Service
}

func NewAuthHandler(service *auth.Service) *AuthHandler {
	return &AuthHandler{service: service}
}

func (h *AuthHandler) Register(w http.ResponseWriter, r *http.Request) {
	var input auth.RegisterInput
	if err := dto.Decode(r, &input); err != nil {
		dto.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}

	user, tokens, err := h.service.Register(r.Context(), input)
	if err != nil {
		if errors.Is(err, auth.ErrUserAlreadyExists) {
			dto.Error(w, http.StatusConflict, err.Error())
			return
		}
		dto.Error(w, http.StatusInternalServerError, "failed to register")
		return
	}

	dto.JSON(w, http.StatusCreated, map[string]interface{}{
		"user":   user,
		"tokens": tokens,
	})
}

func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var input auth.LoginInput
	if err := dto.Decode(r, &input); err != nil {
		dto.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}

	user, tokens, err := h.service.Login(r.Context(), input)
	if err != nil {
		if errors.Is(err, auth.ErrInvalidCredentials) {
			dto.Error(w, http.StatusUnauthorized, err.Error())
			return
		}
		dto.Error(w, http.StatusInternalServerError, "login failed")
		return
	}

	dto.JSON(w, http.StatusOK, map[string]interface{}{
		"user":   user,
		"tokens": tokens,
	})
}

func (h *AuthHandler) RefreshToken(w http.ResponseWriter, r *http.Request) {
	var body struct {
		RefreshToken string `json:"refresh_token"`
	}
	if err := dto.Decode(r, &body); err != nil || body.RefreshToken == "" {
		dto.Error(w, http.StatusBadRequest, "refresh_token is required")
		return
	}

	tokens, err := h.service.RefreshTokens(r.Context(), body.RefreshToken)
	if err != nil {
		dto.Error(w, http.StatusUnauthorized, "invalid refresh token")
		return
	}

	dto.JSON(w, http.StatusOK, tokens)
}

func (h *AuthHandler) Logout(w http.ResponseWriter, r *http.Request) {
	var body struct {
		RefreshToken string `json:"refresh_token"`
	}
	if err := dto.Decode(r, &body); err != nil {
		dto.Error(w, http.StatusBadRequest, "refresh_token is required")
		return
	}

	_ = h.service.Logout(r.Context(), body.RefreshToken)
	w.WriteHeader(http.StatusNoContent)
}

func (h *AuthHandler) GetMe(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())

	user, err := h.service.GetUserByID(r.Context(), userID)
	if err != nil {
		dto.Error(w, http.StatusNotFound, "user not found")
		return
	}

	dto.JSON(w, http.StatusOK, user)
}
